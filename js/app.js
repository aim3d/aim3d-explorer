/* AIM-3D Explorer — static results explorer. BUILD v25 (2026-10-05)
   v3 release: the aggregate democracy index is gone; edges carry signs; the
   matrix follows an exported order; forecasts come from one neural
   forecaster; dynamics are what-if responses from that forecaster.
   The portal reads committed files only and computes no statistics. */
"use strict";

const BUILD = "v29";
const BUILD_DATE = "2026-10-05";

/* Panel ids are kept as before for the UI; data directories use the short
   names the v3 export writes. */
const PANELS = {
  century_factors: { dir: "century", name: "Century view", span: "1900–2023" },
  modern_factors:  { dir: "modern",  name: "Modern view",  span: "1970–2021" },
};
const DIR = (panel) => PANELS[panel].dir;

let GLOSSARY = null;
let TERM_INDEX = null;

const S = {
  panel: "century_factors",
  data: {},          // per-panel: manifest, nodes, edges, edgeMeta, ice, order, history
  countryIndex: {},  // per-panel, lazy
  view: "structure",
  egoNode: null,
  egoView: "table",
  edgeSort: { key: "score_median", dir: -1 },
  matrixSigned: true,
  // forecasts
  fcManifest: {},    // per-panel
  fcAccuracy: {},    // per-panel, lazy
  fcFiles: {},       // "panel/country_id" -> file
  fcCountry: null,   // country_id (number)
  fcNode: null,
  fcH: "1",
  // what-if
  wiAgg: {},         // per-panel aggregate, lazy
  wiFiles: {},       // "panel/whatif_file" -> file
  wiScope: "country",
  wiCountry: null,   // country_id
  wiShock: null,
  wiDir: "rise",
  wiH: "5",
};

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 3) => (x === null || x === undefined || Number.isNaN(x)) ? "–" : Number(x).toFixed(d);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KIND_LABEL = {
  protected_observed: "Protected observed",
  reflective_factor: "Reflective factor",
  formative_composite: "Formative composite",
  singleton: "Singleton",
  indicator: "Indicator",
};
const KIND_ORDER = { protected_observed: 0, reflective_factor: 1, formative_composite: 2, singleton: 3, indicator: 4 };

/* Axis labels on the matrix: display names, shortened; full name and code on hover. */
const MATRIX_LABEL_MAX = 32;
const axisLabel = (n, id) => {
  const l = (n && n.label) || id;
  return l.length > MATRIX_LABEL_MAX ? l.slice(0, MATRIX_LABEL_MAX - 1) + "…" : l;
};

const STRUCTURAL_TIP =
  "Structural (source-only): this node is never modeled as a target. " +
  "Between-country variance dominates its within-country signal (low ICC), " +
  "so within-country dynamics cannot identify effects onto it.";

const WEAK_SIGN_TIP =
  "Weak sign: the effect rises over part of the source's range and falls over " +
  "another, so a firm color would overstate it. The effect curve is the full picture.";

/* Sign colours [decided by Professor Kuskova]: blue positive, red negative,
   shade by score; weak-sign edges in a muted neutral. */
const SIGN = { pos: "#2456c4", neg: "#b3372e", weak: "#8a93a5" };
function signColor(e) {
  if (e.weak_sign) return SIGN.weak;
  return e.sign > 0 ? SIGN.pos : SIGN.neg;
}
function signCellColor(e, maxScore) {
  const t = Math.max(0.12, Math.min(1, e.score_median / maxScore));
  if (e.weak_sign) {
    const a = 0.25 + 0.45 * t;
    return `rgba(138,147,165,${a.toFixed(3)})`;
  }
  const base = e.sign > 0 ? [36, 86, 196] : [179, 55, 46];
  const a = 0.15 + 0.85 * t;
  return `rgba(${base[0]},${base[1]},${base[2]},${a.toFixed(3)})`;
}

/* ─────────────────────── Data loading ───────────────────── */

async function loadPanel(panel) {
  await loadGlossary();
  if (S.data[panel]) return S.data[panel];
  $("loading").hidden = false;
  const base = `data/struct/${DIR(panel)}`;
  const [manifest, nodes, edgesFile, ice, order] = await Promise.all([
    fetchJSON(`${base}/manifest.json`),
    fetchJSON(`${base}/nodes.json`),
    fetchJSON(`${base}/edges.json`),
    fetchJSON(`${base}/ice.json`),
    fetchJSON(`${base}/matrix_order.json`),
  ]);
  let labels = {};
  try {
    const r = await fetch(`data/labels/${DIR(panel)}.json`);
    if (r.ok) labels = await r.json();
  } catch (e) { /* optional */ }
  nodes.forEach((n) => { n.bundle_label = n.label; if (labels[n.id]) n.label = labels[n.id]; });
  const edges = Array.isArray(edgesFile) ? edgesFile : edgesFile.edges;
  const edgeMeta = Array.isArray(edgesFile) ? {} : edgesFile;
  S.data[panel] = { manifest, nodes, edges, edgeMeta, ice, order, history: null };
  $("loading").hidden = true;
  return S.data[panel];
}

/* history.json is large (6 MB); loaded only when a view needs it. */
async function loadHistory(panel) {
  const d = S.data[panel];
  if (d.history !== null) return d.history;
  try {
    const r = await fetch(`data/struct/${DIR(panel)}/history.json`);
    d.history = r.ok ? await r.json() : false;
  } catch (e) { d.history = false; }
  return d.history;
}

async function loadCountryIndex(panel) {
  if (S.countryIndex[panel]) return S.countryIndex[panel];
  const idx = await fetchJSON(`data/country_index_${DIR(panel)}.json`);
  S.countryIndex[panel] = idx;
  return idx;
}

async function loadForecastManifest(panel) {
  if (S.fcManifest[panel]) return S.fcManifest[panel];
  S.fcManifest[panel] = await fetchJSON(`data/fcst/${DIR(panel)}/manifest.json`);
  return S.fcManifest[panel];
}
async function loadAccuracy(panel) {
  if (S.fcAccuracy[panel]) return S.fcAccuracy[panel];
  try {
    const r = await fetch(`data/fcst/${DIR(panel)}/accuracy.json`);
    S.fcAccuracy[panel] = r.ok ? await r.json() : null;
  } catch (e) { S.fcAccuracy[panel] = null; }
  return S.fcAccuracy[panel];
}
/* One file per country, fetched only when selected (about 385 KB each). */
async function loadForecastFile(panel, entry) {
  const key = `${panel}/${entry.country_id}`;
  if (key in S.fcFiles) return S.fcFiles[key];
  try {
    const r = await fetch(`data/fcst/${DIR(panel)}/${entry.forecast_file}`);
    S.fcFiles[key] = r.ok ? await r.json() : null;
  } catch (e) { S.fcFiles[key] = null; }
  return S.fcFiles[key];
}

async function loadWhatIfAggregate(panel) {
  if (panel in S.wiAgg) return S.wiAgg[panel];
  try {
    const r = await fetch(`data/dyn/${DIR(panel)}/irf_aggregate.json`);
    S.wiAgg[panel] = r.ok ? await r.json() : null;
  } catch (e) { S.wiAgg[panel] = null; }
  return S.wiAgg[panel];
}
/* The what-if file name is taken verbatim from the country index (it records
   the Unicode form Drive stores). Should that miss, the other normalization
   form is tried before giving up. */
async function loadWhatIfFile(panel, entry) {
  if (!entry.whatif_file) return null;
  const key = `${panel}/${entry.whatif_file}`;
  if (key in S.wiFiles) return S.wiFiles[key];
  const candidates = [entry.whatif_file];
  ["NFC", "NFD"].forEach((f) => { const alt = entry.whatif_file.normalize(f); if (!candidates.includes(alt)) candidates.push(alt); });
  let file = null;
  for (const name of candidates) {
    try {
      const r = await fetch(`data/dyn/${DIR(panel)}/cfact/${encodeURIComponent(name)}`);
      if (r.ok) { file = await r.json(); break; }
    } catch (e) { /* try next form */ }
  }
  S.wiFiles[key] = file;
  return file;
}

function orderedNodeIds(d) {
  // Row order of record (structural sources form the last band). Fallback keeps kind grouping.
  const o = d.order || {};
  const ro = o.row_order || o.order;
  if (Array.isArray(ro) && ro.length === d.nodes.length) return ro.slice();
  return [...d.nodes]
    .sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || a.id.localeCompare(b.id))
    .map((n) => n.id);
}
/* Node ids by display label, for selectors; the matrix keeps the export order. */
function alphaNodeIds(d) {
  const byId = nodeById(d);
  return d.nodes.map((n) => n.id).sort((a, b) =>
    (byId[a].label || a).localeCompare(byId[b].label || b, undefined, { sensitivity: "base" }));
}
function orderedColumnIds(d) {
  // Columns omit structural nodes: nothing is estimated into them.
  const o = d.order || {};
  if (Array.isArray(o.column_order) && o.column_order.length) return o.column_order.slice();
  const byId = nodeById(d);
  return orderedNodeIds(d).filter((id) => !isStructural(byId[id]));
}
/* Index after which a block boundary falls, for a given axis order. */
function blockBoundaries(d, axisIds) {
  const set = new Set();
  if (!d.order || !d.order.blocks) return set;
  const pos = {}; axisIds.forEach((id, i) => (pos[id] = i));
  let acc = -1;
  d.order.blocks.forEach((b, i) => {
    const inAxis = b.nodes.filter((n) => n in pos);
    if (!inAxis.length) return;
    acc = Math.max(...inAxis.map((n) => pos[n]));
    if (i < d.order.blocks.length - 1 && acc < axisIds.length - 1) set.add(acc);
  });
  return set;
}

/* Carried from the v2 build: tooltips, glossary, charts, neighbourhood network. */
const NS = "http://www.w3.org/2000/svg";
async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
  return r.json();
}

async function loadGlossary() {
  if (GLOSSARY) return GLOSSARY;
  try {
    GLOSSARY = await fetchJSON("data/glossary.json");
  } catch (e) {
    GLOSSARY = { groups: [] }; // glossary is optional; portal works without it
  }
  const idx = [];
  GLOSSARY.groups.forEach((g) => g.terms.forEach((t) =>
    (t.aliases || []).forEach((a) => idx.push([a, t.id]))));
  idx.sort((a, b) => b[0].length - a[0].length); // longest first
  TERM_INDEX = idx;
  return GLOSSARY;
}

function glossaryTerm(id) {
  if (!GLOSSARY) return null;
  for (const g of GLOSSARY.groups)
    for (const t of g.terms)
      if (t.id === id) return t;
  return null;
}

function annotateTerms(container) {
  if (!TERM_INDEX || !container || container.dataset.termified) return;
  container.dataset.termified = "1";
  const seen = new Set();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement.closest(".term, script, style, a, button")
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let text = node.nodeValue;
    for (const [alias, id] of TERM_INDEX) {
      if (seen.has(id)) continue;
      const isAcronym = alias === alias.toUpperCase();
      const pos = isAcronym ? text.indexOf(alias)
        : text.toLowerCase().indexOf(alias.toLowerCase());
      if (pos === -1) continue;
      const before = text.slice(0, pos);
      const match = text.slice(pos, pos + alias.length);
      const after = text.slice(pos + alias.length);
      const span = document.createElement("span");
      span.className = "term";
      span.dataset.term = id;
      span.textContent = match;
      const afterNode = document.createTextNode(after);
      node.nodeValue = before;
      node.parentNode.insertBefore(span, node.nextSibling);
      node.parentNode.insertBefore(afterNode, span.nextSibling);
      seen.add(id);
      break; // continue scanning in afterNode on later iterations
    }
  }
}

function annotateView(viewId) {
  const view = document.getElementById(viewId);
  if (!view) return;
  view.querySelectorAll(".view-lede, .footnote, .block-title, .methods-card p, .methods-card li").forEach((el) => {
    delete el.dataset.termified; // footnotes are rewritten per render
    annotateTerms(el);
  });
}

function nodeById(d) {
  const m = {};
  d.nodes.forEach((n) => (m[n.id] = n));
  return m;
}

function isStructural(n) { return n.role !== "dynamic"; }

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function linScale(dmin, dmax, rmin, rmax) {
  const span = dmax - dmin || 1;
  const f = (x) => rmin + ((x - dmin) / span) * (rmax - rmin);
  f.ticks = (n) => {
    const step = niceStep(span / n);
    const start = Math.ceil(dmin / step) * step;
    const out = [];
    for (let v = start; v <= dmax + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  return f;
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
}

function chartFrame(svg, opts) {
  svg.innerHTML = "";
  const W = svg.clientWidth || 760;
  const H = svg.clientHeight || 340;
  const m = Object.assign({ top: 16, right: 18, bottom: 42, left: 56 }, opts.margin || {});
  const x = linScale(opts.xmin, opts.xmax, m.left, W - m.right);
  const y = linScale(opts.ymin, opts.ymax, H - m.bottom, m.top);
  const g = el("g");
  svg.appendChild(g);

  // gridlines + ticks
  y.ticks(5).forEach((t) => {
    g.appendChild(el("line", { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), stroke: "#eceef2" }));
    g.appendChild(el("text", { x: m.left - 8, y: y(t) + 4, "text-anchor": "end", "font-size": 11, fill: "#6b7486", "font-family": "IBM Plex Mono, monospace" }, fmtTick(t)));
  });
  (opts.xticks || x.ticks(7)).forEach((t) => {
    g.appendChild(el("line", { x1: x(t), x2: x(t), y1: H - m.bottom, y2: H - m.bottom + 4, stroke: "#6b7486" }));
    g.appendChild(el("text", { x: x(t), y: H - m.bottom + 18, "text-anchor": "middle", "font-size": 11, fill: "#6b7486", "font-family": "IBM Plex Mono, monospace" }, fmtTick(t)));
  });
  g.appendChild(el("line", { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom, stroke: "#2a3342" }));
  g.appendChild(el("line", { x1: m.left, x2: m.left, y1: m.top, y2: H - m.bottom, stroke: "#2a3342" }));

  if (opts.xlabel) svg.appendChild(el("text", { x: (m.left + W - m.right) / 2, y: H - 6, "text-anchor": "middle", "font-size": 12, fill: "#2a3342" }, opts.xlabel));
  if (opts.ylabel) {
    const t = el("text", { x: 14, y: (m.top + H - m.bottom) / 2, "text-anchor": "middle", "font-size": 12, fill: "#2a3342", transform: `rotate(-90 14 ${(m.top + H - m.bottom) / 2})` }, opts.ylabel);
    svg.appendChild(t);
  }
  return { svg, x, y, W, H, m };
}

function fmtTick(t) {
  if (Math.abs(t) >= 1000) return String(Math.round(t));
  return String(+t.toFixed(3));
}

function pathFrom(pts, x, y) {
  return pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
}

function addLine(f, pts, stroke, opts = {}) {
  f.svg.appendChild(el("path", Object.assign({
    d: pathFrom(pts, f.x, f.y), fill: "none", stroke, "stroke-width": opts.width || 2,
  }, opts.dash ? { "stroke-dasharray": opts.dash } : {}, opts.opacity ? { opacity: opts.opacity } : {})));
}

function addBand(f, xs, lo, hi, fill, opacity) {
  const up = xs.map((xv, i) => [xv, hi[i]]);
  const dn = xs.map((xv, i) => [xv, lo[i]]).reverse();
  const d = pathFrom(up, f.x, f.y) + pathFrom(dn, f.x, f.y).replace(/^M/, "L") + "Z";
  f.svg.appendChild(el("path", { d, fill, opacity: opacity || 0.25, stroke: "none" }));
}

function divergingColor(v) {
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    const a = t;
    return `rgb(${Math.round(255 - a * (255 - 36))},${Math.round(255 - a * (255 - 86))},${Math.round(255 - a * (255 - 196))})`;
  }
  const a = -t;
  return `rgb(${Math.round(255 - a * (255 - 179))},${Math.round(255 - a * (255 - 55))},${Math.round(255 - a * (255 - 46))})`;
}

function bluescale(v) {
  const a = Math.max(0, Math.min(1, v));
  return `rgb(${Math.round(255 - a * (255 - 23))},${Math.round(255 - a * (255 - 58))},${Math.round(255 - a * (255 - 133))})`;
}

function ensureTooltipEl() {
  let t = document.getElementById("tooltip");
  if (!t) {
    t = document.createElement("div");
    t.id = "tooltip";
    t.className = "tooltip";
    t.hidden = true;
    document.body.appendChild(t);
  }
  return t;
}

function attachMatrixTooltip(wrap) {
  const tip = ensureTooltipEl();
  const show = (target, ev) => {
    const raw = target.dataset.tip;
    const [head, rest] = raw.split("\u0001");
    tip.innerHTML = rest !== undefined
      ? `${esc(head)}<span class="tip-id">${esc(rest)}</span>`
      : esc(head);
    tip.hidden = false;
    move(ev);
  };
  const move = (ev) => {
    const pad = 14;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  };
  wrap.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest("[data-tip]");
    if (t) show(t, ev);
  });
  wrap.addEventListener("mousemove", (ev) => {
    if (!tip.hidden) move(ev);
  });
  wrap.addEventListener("mouseout", (ev) => {
    if (!ev.relatedTarget || !ev.relatedTarget.closest || !ev.relatedTarget.closest("[data-tip]")) tip.hidden = true;
  });
  wrap.addEventListener("mouseleave", () => { tip.hidden = true; });
}

function attachTermTooltips() {
  const tip = ensureTooltipEl();
  document.body.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest("[data-term]");
    if (!t) return;
    const g = glossaryTerm(t.dataset.term);
    if (!g) return;
    tip.innerHTML = `<strong>${esc(g.term)}</strong><br>${esc(g.short)}`;
    tip.hidden = false;
    const pad = 14;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = ev.clientX - tip.offsetWidth - pad;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = ev.clientY - tip.offsetHeight - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  });
  document.body.addEventListener("mouseout", (ev) => {
    if (ev.target.closest && ev.target.closest("[data-term]")) tip.hidden = true;
  });
}

function renderGuide() {
  const body = $("guide-body");
  if (!GLOSSARY || !GLOSSARY.groups.length) {
    body.innerHTML = '<p class="footnote">Guide unavailable.</p>';
    return;
  }
  body.innerHTML = GLOSSARY.groups.map((g) =>
    `<div class="guide-group"><h3>${esc(g.title)}</h3>` +
    g.terms.map((t) =>
      `<div class="guide-entry" id="guide-${esc(t.id)}"><h4>${esc(t.term)}</h4><p>${esc(t.long)}</p></div>`
    ).join("") + `</div>`
  ).join("");
}


function buildEgoGraph(d, focusId, includeMajority) {
  const edges = d.edges.filter((e) => e.consensus || includeMajority);
  const inc = edges.filter((e) => e.target === focusId);
  const out = edges.filter((e) => e.source === focusId);
  const nbrs = new Set([...inc.map((e) => e.source), ...out.map((e) => e.target)]);
  const all = new Set([focusId, ...nbrs]);
  const among = edges.filter((e) =>
    all.has(e.source) && all.has(e.target) &&
    e.source !== focusId && e.target !== focusId);
  return { inc, out, nbrs: [...nbrs], among };
}

function drawEgoNetwork(host, d, focusId) {
  const byId = nodeById(d);
  /* The network mirrors the table's edge set — every retained edge for this
     node — rather than following the matrix's consensus filter, so the two
     views of the same panel never disagree. Majority-only edges are drawn
     grey instead of being hidden. */
  const g = buildEgoGraph(d, focusId, true);
  const focus = byId[focusId];

  if (!g.nbrs.length) {
    host.innerHTML = `<p class="footnote">No retained edges for this node.</p>`;
    return;
  }

  const ids = [focusId, ...g.nbrs];
  const idx = {};
  ids.forEach((id, i) => (idx[id] = i));
  const n = ids.length;
  const egoEdges = [...g.inc, ...g.out];
  const allEdges = [...egoEdges, ...g.among];

  // ── Graph-theoretic distances (undirected BFS) ──────────────────────
  const adj = ids.map(() => []);
  allEdges.forEach((e) => {
    const a = idx[e.source], b = idx[e.target];
    if (a === undefined || b === undefined || a === b) return;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  });
  const D = ids.map((_, s) => {
    const dist = new Array(n).fill(Infinity);
    dist[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      for (const v of adj[q[h]]) {
        if (dist[v] === Infinity) { dist[v] = dist[q[h]] + 1; q.push(v); }
      }
    }
    return dist.map((x) => (x === Infinity ? 3 : x));   // disconnected fallback
  });

  // ── Stress majorization (SMACOF), the Kamada–Kawai objective ────────
  // Deterministic: circular seed, fixed iteration count. Small graphs
  // (n <= ~25 here), so cost is negligible.
  const L = 130;                                  // target unit edge length
  let X = ids.map((_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [L * Math.cos(a), L * Math.sin(a)];
  });
  const w = D.map((row) => row.map((dij) => (dij > 0 ? 1 / (dij * dij) : 0)));
  for (let it = 0; it < 300; it++) {
    const Y = X.map((p) => p.slice());
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, sw = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1];
        const dist = Math.hypot(dx, dy) || 1e-6;
        const target = L * D[i][j];
        sx += w[i][j] * (X[j][0] + (target * dx) / dist);
        sy += w[i][j] * (X[j][1] + (target * dy) / dist);
        sw += w[i][j];
      }
      if (sw > 0) { Y[i][0] = sx / sw; Y[i][1] = sy / sw; }
    }
    X = Y;
  }

  // ── Fit to the viewBox, leaving room for labels ─────────────────────
  const W = 860, H = 620;
  const PAD = { x: 132, y: 46 };
  const xs = X.map((p) => p[0]), ys = X.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min((W - 2 * PAD.x) / spanX, (H - 2 * PAD.y) / spanY);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const pos = {};
  ids.forEach((id, i) => {
    pos[id] = {
      x: W / 2 + (X[i][0] - midX) * scale,
      y: H / 2 + (X[i][1] - midY) * scale,
    };
  });
  const cxAll = W / 2;

  const maxScore = Math.max(...allEdges.map((e) => e.score_median), 1e-9);
  const NR = 6, FR = 10;

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`, class: "ego-net",
    role: "img", "aria-label": `Network around ${focus ? focus.label : focusId}`,
  });

  const defs = el("defs");
  [["arrow-pos", SIGN.pos], ["arrow-neg", SIGN.neg], ["arrow-weak", SIGN.weak]]
    .forEach(([id, color]) => {
      const m = el("marker", {
        id, viewBox: "0 0 10 10", refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse",
      });
      m.appendChild(el("path", { d: "M0,1 L10,5 L0,9 z", fill: color }));
      defs.appendChild(m);
    });
  svg.appendChild(defs);

  const tipFor = (e) => edgeTip(e, byId);
  const radiusOf = (id) => (id === focusId ? FR : NR);

  // Reciprocal pairs get a slight bow so both directions stay visible.
  const pairKey = (a, b) => [a, b].sort().join("|");
  const pairCount = {};
  allEdges.forEach((e) => {
    const k = pairKey(e.source, e.target);
    pairCount[k] = (pairCount[k] || 0) + 1;
  });

  const edgesG = el("g");
  allEdges.forEach((e) => {
    const a = pos[e.source], b = pos[e.target];
    if (!a || !b) return;
    const st = edgeStyle(e, maxScore);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = a.x + ux * (radiusOf(e.source) + 1);
    const sy = a.y + uy * (radiusOf(e.source) + 1);
    const ex = b.x - ux * (radiusOf(e.target) + 5);
    const ey = b.y - uy * (radiusOf(e.target) + 5);
    const isEgo = e.source === focusId || e.target === focusId;
    const baseOp = isEgo ? Math.min(1, st.opacity + 0.15) : st.opacity * 0.5;
    const attrs = {
      fill: "none", stroke: st.stroke,
      "stroke-width": isEgo ? st.width : st.width * 0.8,
      opacity: baseOp, "marker-end": `url(#${st.marker})`,
      "data-tip": tipFor(e), class: "ego-edge-line",
      "data-s": e.source, "data-t": e.target, "data-op": baseOp.toFixed(3),
      ...(st.dash ? { "stroke-dasharray": st.dash } : {}),
    };
    if (pairCount[pairKey(e.source, e.target)] > 1) {
      // bow perpendicular to the segment, direction fixed by node order
      const sign = e.source < e.target ? 1 : -1;
      const bow = Math.min(26, len * 0.14) * sign;
      const mx = (sx + ex) / 2 - uy * bow, my = (sy + ey) / 2 + ux * bow;
      attrs.d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
      edgesG.appendChild(el("path", attrs));
    } else {
      attrs.d = `M${sx.toFixed(1)},${sy.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
      edgesG.appendChild(el("path", attrs));
    }
  });
  svg.appendChild(edgesG);

  // ── Nodes and labels ────────────────────────────────────────────────
  const nodesG = el("g");
  ids.forEach((id) => {
    const nd = byId[id], p = pos[id];
    const isFocus = id === focusId;
    const structural = nd && isStructural(nd);
    nodesG.appendChild(el("circle", {
      cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: radiusOf(id),
      fill: isFocus ? "#16233b" : (structural ? "#eef0f3" : "#ffffff"),
      stroke: isFocus ? "#16233b" : (structural ? "#8a93a5" : "#2456c4"),
      "stroke-width": isFocus ? 2 : 1.8,
      class: isFocus ? "" : "ego-net-node",
      ...(isFocus ? {} : { "data-node": id }),
      "data-tip": `${nd ? nd.label : id}\u0001${id}${structural ? "\n" + STRUCTURAL_TIP : ""}`,
    }));
  });

  // Labels: side chosen by position, white halo so overlaps stay legible.
  ids.forEach((id) => {
    const nd = byId[id], p = pos[id];
    const isFocus = id === focusId;
    const right = p.x >= cxAll;
    const raw = nd ? nd.label : id;
    const label = raw.length > 26 ? raw.slice(0, 25) + "…" : raw;
    const off = radiusOf(id) + 7;
    nodesG.appendChild(el("text", {
      x: (p.x + (right ? off : -off)).toFixed(1),
      y: (p.y + 3.8).toFixed(1),
      "text-anchor": right ? "start" : "end",
      "font-size": isFocus ? 12.5 : 11,
      "font-weight": isFocus ? 600 : 400,
      fill: isFocus ? "#16233b" : "#2a3342",
      "font-family": "IBM Plex Sans, sans-serif",
      stroke: "#fbfbf9", "stroke-width": 3.5, "paint-order": "stroke fill",
      class: isFocus ? "" : "ego-net-label",
      ...(isFocus ? {} : { "data-node": id }),
      "data-tip": `${raw}\u0001${id}`,
    }, label));
  });
  svg.appendChild(nodesG);

  host.innerHTML = "";
  host.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML =
    `<span class="key"><span class="key-line" style="border-color:${SIGN.pos}"></span>positive</span>` +
    `<span class="key"><span class="key-line" style="border-color:${SIGN.neg}"></span>negative</span>` +
    `<span class="key"><span class="key-line" style="border-color:${SIGN.weak}"></span>weak sign</span>` +
    `<span class="key"><span class="key-line dashed" style="border-color:#6b7486"></span>majority only (2 of 3 seeds)</span>` +
    `<span class="key"><span class="key-band" style="background:#eef0f3;border:1px solid #8a93a5"></span>structural (source-only)</span>` +
    `<span class="key">${g.nbrs.length} neighbours · ${egoEdges.length} edges to focus · ${g.among.length} among neighbours</span>`;
  host.appendChild(legend);

  const note = document.createElement("p");
  note.className = "footnote";
  note.textContent =
    "Layout is by stress majorization on graph distances (Kamada–Kawai objective): " +
    "densely connected variables are placed near one another, so clusters are structural, " +
    "not decorative. Positions are deterministic — the same node always lays out the same way. " +
    "Thickness and opacity encode the causal score; arrows show direction. " +
    "The focus node's own edges are drawn more strongly than edges among its neighbours. " +
    "Hover any node to isolate its edges; click a neighbour to centre the network on it.";
  host.appendChild(note);

  attachMatrixTooltip(host);
  host.querySelectorAll("[data-node]").forEach((nEl) =>
    nEl.addEventListener("click", () => { S.egoNode = nEl.dataset.node; renderStructure(); }));

  /* Hover isolation. Dense neighbourhoods cross a lot however they are laid
     out, so hovering a node fades everything not incident to it. */
  const edgeEls = [...svg.querySelectorAll("path[data-s]")];
  const nodeEls = [...svg.querySelectorAll("circle[data-tip]")];
  const labelEls = [...svg.querySelectorAll("text[data-tip]")];
  const posOf = {};
  ids.forEach((id) => (posOf[id] = true));

  const isolate = (id) => {
    const keep = new Set([id]);
    edgeEls.forEach((p) => {
      const on = p.dataset.s === id || p.dataset.t === id;
      p.setAttribute("opacity", on ? 1 : 0.06);
      p.setAttribute("stroke-width",
        String(parseFloat(p.getAttribute("stroke-width")) || 1));
      if (on) { keep.add(p.dataset.s); keep.add(p.dataset.t); }
    });
    nodeEls.forEach((c) => {
      const cid = c.dataset.node || focusId;
      c.setAttribute("opacity", keep.has(cid) ? 1 : 0.25);
    });
    labelEls.forEach((t) => {
      const tid = t.dataset.node || focusId;
      t.setAttribute("opacity", keep.has(tid) ? 1 : 0.2);
    });
  };
  const clearIsolate = () => {
    edgeEls.forEach((p) => p.setAttribute("opacity", p.dataset.op));
    nodeEls.forEach((c) => c.setAttribute("opacity", 1));
    labelEls.forEach((t) => t.setAttribute("opacity", 1));
  };
  [...nodeEls, ...labelEls].forEach((elm) => {
    const id = elm.dataset.node || focusId;
    elm.addEventListener("mouseenter", () => isolate(id));
    elm.addEventListener("mouseleave", clearIsolate);
  });
}

function renderEgo() {
  const panelEl = $("ego-panel");
  if (!S.egoNode) { panelEl.hidden = true; return; }
  const d = S.data[S.panel];
  const byId = nodeById(d);
  const n = byId[S.egoNode];
  if (!n) { panelEl.hidden = true; return; }

  const inc = d.edges.filter((e) => e.target === n.id).sort((a, b) => b.score_median - a.score_median);
  const out = d.edges.filter((e) => e.source === n.id).sort((a, b) => b.score_median - a.score_median);

  const edgeRow = (e, other) => {
    const o = byId[other];
    const badges =
      (e.weak_sign ? `<span class="badge badge-weak" title="${esc(WEAK_SIGN_TIP)}">weak</span>` :
        (e.sign > 0 ? '<span class="badge badge-pos">+</span>' : '<span class="badge badge-neg">−</span>')) +
      " " + (e.consensus ? '<span class="badge badge-consensus">3/3</span>' : `<span class="badge badge-majority">${esc(e.retention)}</span>`);
    return `<div class="ego-edge"><span title="${esc(other)}">${esc(o ? o.label : other)}</span><span>${badges} <span class="mono">${fmt(e.score_median, 4)}</span></span></div>`;
  };

  const members = n.members && n.members.length
    ? `<div class="ego-meta">Members: <span class="mono">${n.members.map(esc).join(" · ")}</span></div>` : "";
  const structuralNote = isStructural(n)
    ? `<div class="ego-meta"><span class="badge badge-structural">structural · source-only</span> ${esc(STRUCTURAL_TIP)}</div>` : "";

  const isNet = S.egoView === "network";
  panelEl.innerHTML =
    `<div class="ego-head">` +
      `<div><h3>${esc(n.label)}</h3>` +
      `<span class="ego-id">${esc(n.id)} · ${esc(KIND_LABEL[n.kind] || n.kind)} · ICC ${fmt(n.icc, 3)}</span></div>` +
      `<div class="ego-actions">` +
        `<span class="seg-toggle" role="group" aria-label="Neighbourhood view">` +
          `<button class="seg${isNet ? "" : " on"}" id="ego-view-table" aria-pressed="${!isNet}">Table</button>` +
          `<button class="seg${isNet ? " on" : ""}" id="ego-view-network" aria-pressed="${isNet}">Network</button>` +
        `</span>` +
        `<button class="btn-quiet" id="ego-close">Close</button>` +
      `</div>` +
    `</div>` +
    members + structuralNote +
    (isNet
      ? `<div class="ego-net-host" id="ego-net-host"></div>`
      : `<div class="ego-cols">` +
        `<div><h4>Incoming (${inc.length})</h4>${inc.map((e) => edgeRow(e, e.source)).join("") || '<div class="ego-meta">None in retained set.</div>'}</div>` +
        `<div><h4>Outgoing (${out.length})</h4>${out.map((e) => edgeRow(e, e.target)).join("") || '<div class="ego-meta">None in retained set.</div>'}</div>` +
        `</div>`);
  panelEl.hidden = false;

  if (isNet) drawEgoNetwork($("ego-net-host"), d, n.id);

  $("ego-close").addEventListener("click", () => { S.egoNode = null; renderStructure(); });
  $("ego-view-table").addEventListener("click", () => { S.egoView = "table"; renderEgo(); });
  $("ego-view-network").addEventListener("click", () => { S.egoView = "network"; renderEgo(); });
}

/* ─────────────────────── View: Structure ────────────────── */

function edgeTip(e, byId) {
  const s = byId[e.source], t = byId[e.target];
  return `${s ? s.label : e.source} → ${t ? t.label : e.target}\u0001` +
    `${e.source} → ${e.target}\n` +
    `${e.sign > 0 ? "positive" : "negative"} · score ${fmt(e.score_median, 4)} [${fmt(e.score_min, 4)}–${fmt(e.score_max, 4)}]\n` +
    `sign agreement ${fmt(e.sign_agreement, 2)} · sign strength ${fmt(e.sign_strength, 2)}` +
    (e.weak_sign ? "\n" + WEAK_SIGN_TIP : "") +
    `\nretained ${e.retention}${e.consensus ? " (consensus)" : ""}`;
}

function renderStructure() {
  const d = S.data[S.panel];
  const byId = nodeById(d);
  const ids = orderedNodeIds(d);        // rows: every node
  const cols = orderedColumnIds(d);     // columns: receivers only
  const showMajority = $("matrix-majority").checked;
  const edges = d.edges.filter((e) => e.consensus || showMajority);
  const maxScore = Math.max(...d.edges.map((e) => e.score_median));
  const eMap = {};
  edges.forEach((e) => (eMap[`${e.source}->${e.target}`] = e));
  const rowB = blockBoundaries(d, ids);
  const colB = blockBoundaries(d, cols);

  $("matrix-legend").innerHTML =
    `<span><span class="swatch" style="background:${SIGN.pos}"></span>positive</span>` +
    `<span><span class="swatch" style="background:${SIGN.neg}"></span>negative</span>` +
    `<span><span class="swatch" style="background:${SIGN.weak}"></span>weak sign</span>` +
    `<span><span class="swatch" style="background:var(--grey-cell)"></span>structural target (not modeled)</span>` +
    `<span>shade = causal score</span>`;

  const tbl = document.createElement("table");
  tbl.className = "matrix";
  const thead = document.createElement("thead");
  let hr = "<tr><th></th>";
  cols.forEach((id, j) => {
    const n = byId[id];
    const cls = (S.egoNode === id ? "is-selected " : "") + (colB.has(j) ? "blk-r" : "");
    const tip = `${n.label}\u0001${id}${isStructural(n) ? "\n" + STRUCTURAL_TIP : ""}`;
    hr += `<th class="${cls}"><button data-node="${esc(id)}" data-tip="${esc(tip)}">${esc(axisLabel(n, id))}</button></th>`;
  });
  thead.innerHTML = hr + "</tr>";
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  ids.forEach((src, i) => {
    const tr = document.createElement("tr");
    if (rowB.has(i)) tr.className = "blk-b";
    const sn = byId[src];
    const selCls = S.egoNode === src ? ' class="is-selected"' : "";
    const structRow = isStructural(sn) ? " (source only)" : "";
    let row = `<th${selCls}><button data-node="${esc(src)}" data-tip="${esc(sn.label + structRow + "\u0001" + src + (isStructural(sn) ? "\n" + STRUCTURAL_TIP : ""))}">${esc(axisLabel(sn, src))}</button></th>`;
    cols.forEach((tgt, j) => {
      const bcls = colB.has(j) ? " blk-r" : "";
      if (src === tgt) { row += `<td class="diag${bcls}"></td>`; return; }
      const e = eMap[`${src}->${tgt}`];
      if (!e) { row += `<td class="${bcls.trim()}"></td>`; return; }
      const col = signCellColor(e, maxScore);
      const op = e.consensus ? 1 : 0.45;
      row += `<td class="${bcls.trim()}" style="background:${col};opacity:${op}" data-tip="${esc(edgeTip(e, byId))}"></td>`;
    });
    tr.innerHTML = row;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);

  const wrap = $("matrix-wrap");
  wrap.innerHTML = "";
  wrap.appendChild(tbl);
  tbl.querySelectorAll("button[data-node]").forEach((b) =>
    b.addEventListener("click", () => { S.egoNode = b.dataset.node; renderStructure(); }));
  attachMatrixTooltip(wrap);

  const o = d.order || {};
  const cc = o.chance_comparison;
  $("matrix-order-note").textContent =
    (o.caption
      ? o.caption
      : "Variables are ordered so that strongly linked ones sit together. The groupings are an aid to reading and are not statistically distinct clusters" +
        (cc ? ` (modularity ${fmt(cc.observed, 3)} against ${fmt(cc.rewired_mean, 3)} in randomly rewired graphs of the same density).` : ".")) +
    " Rows are sources, columns are receivers; structural (source-only) variables appear as rows only, since nothing is estimated into them. " +
    "Weak-sign edges are muted: for those the effect rises over part of the source's range and falls over another; the effect curve is the full picture.";

  renderEgo();
}

/* Edge style used by the neighbourhood network. */
function edgeStyle(e, maxScore) {
  const t = maxScore ? e.score_median / maxScore : 0;
  const stroke = signColor(e);
  return {
    stroke,
    width: 1 + 2.6 * Math.sqrt(t),
    opacity: (0.3 + 0.6 * Math.sqrt(t)) * (e.consensus ? 1 : 0.6),
    marker: e.weak_sign ? "arrow-weak" : (e.sign > 0 ? "arrow-pos" : "arrow-neg"),
    dash: e.consensus ? null : "5 4",
  };
}

/* ───────────────────────── View: Edges ──────────────────── */

const EDGE_COLS = [
  { key: "source", label: "Source" },
  { key: "target", label: "Target" },
  { key: "sign", label: "Sign" },
  { key: "score_median", label: "Score (median)" },
  { key: "range", label: "[min – max]", sortKey: "score_max" },
  { key: "sign_strength", label: "Sign strength" },
  { key: "retention", label: "Seeds" },
];

function renderEdges() {
  const d = S.data[S.panel];
  const byId = nodeById(d);
  const consOnly = $("edges-consensus-only").checked;
  const signFilter = $("edges-sign").value;
  const q = $("edges-search").value.trim().toLowerCase();

  let rows = d.edges.filter((e) => !consOnly || e.consensus);
  if (signFilter === "pos") rows = rows.filter((e) => e.sign > 0 && !e.weak_sign);
  else if (signFilter === "neg") rows = rows.filter((e) => e.sign < 0 && !e.weak_sign);
  else if (signFilter === "weak") rows = rows.filter((e) => e.weak_sign);
  if (q) {
    rows = rows.filter((e) => {
      const s = byId[e.source], t = byId[e.target];
      return [e.source, e.target, s && s.label, t && t.label].join(" ").toLowerCase().includes(q);
    });
  }
  const { key, dir } = S.edgeSort;
  rows = [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  $("edges-count").textContent = `${rows.length} edges shown`;
  const tbl = $("edges-table");
  let html = "<thead><tr>";
  EDGE_COLS.forEach((c) => {
    const sk = c.sortKey || c.key;
    const mark = key === sk ? `<span class="sort-mark">${dir === 1 ? "▲" : "▼"}</span>` : "";
    html += `<th data-sort="${sk}">${c.label} ${mark}</th>`;
  });
  html += "</tr></thead><tbody>";
  rows.forEach((e) => {
    const s = byId[e.source], t = byId[e.target];
    const signBadge = e.weak_sign
      ? `<span class="badge badge-weak" title="${esc(WEAK_SIGN_TIP)}">weak</span>`
      : (e.sign > 0 ? '<span class="badge badge-pos">+</span>' : '<span class="badge badge-neg">−</span>');
    html += `<tr>
      <td class="mono">${esc(e.source)}<span class="cell-label">${esc(s ? s.label : "")}</span></td>
      <td class="mono">${esc(e.target)}<span class="cell-label">${esc(t ? t.label : "")}</span></td>
      <td>${signBadge}</td>
      <td class="mono">${fmt(e.score_median, 4)}</td>
      <td class="mono">[${fmt(e.score_min, 4)} – ${fmt(e.score_max, 4)}]</td>
      <td class="mono">${fmt(e.sign_strength, 2)} <span class="cell-label">agreement ${fmt(e.sign_agreement, 2)}</span></td>
      <td class="mono">${esc(e.retention)}${e.consensus ? "" : ' <span class="badge badge-majority">majority</span>'}</td></tr>`;
  });
  tbl.innerHTML = html + "</tbody>";
  tbl.querySelectorAll("th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const sk = th.dataset.sort;
      S.edgeSort = { key: sk, dir: S.edgeSort.key === sk ? -S.edgeSort.dir : -1 };
      renderEdges();
    }));
}

/* ────────────────────────── View: ICE ───────────────────── */

/* Neutral set for the three regimes: light to dark, so they cannot be read
   as the sign colours used elsewhere. */
const REGIMES = [
  { key: "low", label: "Low clean-elections tercile", color: "#b89a5c" },
  { key: "mid", label: "Middle tercile", color: "#6f6f6f" },
  { key: "high", label: "High clean-elections tercile", color: "#16233b" },
];

function populateIceSelect() {
  const d = S.data[S.panel];
  const sel = $("ice-edge");
  const byId = nodeById(d);
  const disp = (id) => (byId[id] ? byId[id].label : id);
  const keys = Object.keys(d.ice).sort((a, b) => {
    const [as, at] = a.split("->"), [bs, bt] = b.split("->");
    return disp(as).localeCompare(disp(bs)) || disp(at).localeCompare(disp(bt));
  });
  if (sel.dataset.panel !== S.panel) {
    sel.innerHTML = keys.map((k) => {
      const [src, tgt] = k.split("->");
      return `<option value="${esc(k)}">${esc(disp(src))} → ${esc(disp(tgt))}</option>`;
    }).join("");
    sel.dataset.panel = S.panel;
    // Open on the strongest consensus edge into the clean elections index.
    const into = d.edges.filter((e) => e.consensus && e.target === "v2xel_frefair")
      .sort((a, b) => b.score_median - a.score_median)[0];
    if (into) sel.value = `${into.source}->${into.target}`;
  }
}

function renderICE() {
  const d = S.data[S.panel];
  const key = $("ice-edge").value;
  const rec = d.ice[key];
  if (!rec) return;
  const [src, tgt] = key.split("->");
  const byId = nodeById(d);
  const srcLabel = byId[src] ? byId[src].label : src;
  const tgtLabel = byId[tgt] ? byId[tgt].label : tgt;

  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
  REGIMES.forEach((r) => {
    const c = rec[r.key]; if (!c) return;
    c.grid.forEach((v) => { xmin = Math.min(xmin, v); xmax = Math.max(xmax, v); });
    c.delta.forEach((v) => { if (v !== null) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); } });
  });
  const pad = (ymax - ymin) * 0.08 || 0.01;
  const f = chartFrame($("ice-chart"), {
    xmin, xmax, ymin: ymin - pad, ymax: ymax + pad,
    xlabel: `${srcLabel} (standardized units)`,
    ylabel: `Effect on ${tgtLabel} (standardized units)`,
  });
  f.svg.appendChild(el("line", { x1: f.m.left, x2: f.W - f.m.right, y1: f.y(0), y2: f.y(0), stroke: "#b8bdc7", "stroke-dasharray": "3 3" }));
  REGIMES.forEach((r) => {
    const c = rec[r.key]; if (!c) return;
    const pts = c.grid.map((g, i) => [g, c.delta[i]]).filter((p) => p[1] !== null && p[1] !== undefined);
    addLine(f, pts, r.color, { width: 2.2 });
  });
  $("ice-legend").innerHTML = REGIMES.map((r) =>
    `<span class="key"><span class="key-line" style="border-color:${r.color}"></span>${r.label}</span>`).join("");

  const e = d.edges.find((x) => `${x.source}->${x.target}` === key);
  $("ice-note").innerHTML =
    (e ? `Edge sign: <strong>${e.sign > 0 ? "positive" : "negative"}</strong>` +
      (e.weak_sign ? ` <span class="badge badge-weak">weak</span> — ${esc(WEAK_SIGN_TIP)}` : "") + ". " : "") +
    "Regimes are terciles of the clean elections index. " +
    "NAVAR is additive, so the three curves of an edge have the same shape and differ by a constant: " +
    "the split shows where each regime's typical values sit, not different effects in different regimes. " +
    "The grid spans the 2nd–98th percentile of the source's observed values.";
}

/* ─────────────────── Placeholder views (later stages) ───── */

function renderPlaceholder(id, text) {
  const host = $(id);
  if (host) host.innerHTML = `<p class="footnote">${esc(text)}</p>`;
}

/* ─────────────────────── View: Methods ─────────────────────
   Text comes from data/methods.json, the same file the assistant reads, so
   the page and the assistant cannot drift apart. Numbers come from the
   export files. */

let METHODS = null;
async function loadMethods() {
  if (METHODS) return METHODS;
  try { METHODS = await fetchJSON("data/methods.json"); } catch (e) { METHODS = { sections: [], references: [] }; }
  return METHODS;
}

async function renderMethods() {
  const d = S.data[S.panel];
  const m = d.manifest;
  const p = m.provenance || {};
  const o = d.order || {};
  const cc = o.chance_comparison || {};
  const [M, acc, fman] = await Promise.all([loadMethods(), loadAccuracy(S.panel), loadForecastManifest(S.panel)]);
  const kinds = {};
  d.nodes.forEach((n) => (kinds[n.kind] = (kinds[n.kind] || 0) + 1));
  const kindLine = Object.entries(kinds)
    .sort((a, b) => (KIND_ORDER[a[0]] - KIND_ORDER[b[0]]))
    .map(([k, v]) => `${v} ${(KIND_LABEL[k] || k).toLowerCase()}${v > 1 ? "s" : ""}`).join(" · ");
  const nStructural = d.nodes.filter(isStructural).length;
  const sentence = (v) => (typeof v === "string" ? v : "");
  const hLab = (h) => (String(h) === "10" ? "10 years (not validated)" : `${h} year${h === 1 ? "" : "s"}`);

  const sections = (M.sections || []).map((sec) =>
    `<div class="methods-card"><h3>${esc(sec.title)}</h3>${sec.paragraphs.map((para) => `<p>${esc(para)}</p>`).join("")}</div>`).join("");

  const evalTable = acc && acc.overall ? `
    <div class="methods-card">
      <h3>Forecast accuracy on this panel</h3>
      <p>Forecasts made from ${esc(acc.evaluation_origins || "2006")}, scored against what was then observed. Error as a percentage of each variable's observed range, beside the same error for a no-change forecast, and the mean absolute error relative to no change (below 1 means the forecast is ahead).</p>
      <table class="data-table"><thead><tr><th>Horizon</th><th>Forecasts scored</th><th>Error, % of range</th><th>No change, % of range</th><th>MAE against no change</th></tr></thead><tbody>
      ${acc.overall.map((r) => `<tr><td>${hLab(r.h)}</td><td class="mono">${r.forecasts}</td><td class="mono">${fmt(r.error_pct_of_range, 2)}%</td><td class="mono">${fmt(r.error_pct_of_range_persistence, 2)}%</td><td class="mono">${fmt(r.mae_vs_persistence, 3)}</td></tr>`).join("")}
      </tbody></table>
      <p>These variables change slowly, so any forecast, including no change, scores well. The forecast's margin over no change is small and narrows with horizon, and for some variables the point forecast is behind no change. Per-variable and per-country figures are in the Forecasts view.</p>
    </div>` : "";

  $("methods-body").innerHTML = `
    <div class="methods-card">
      <h3>What changed in this rebuild</h3>
      <p>${esc(M.rebuild || "")}</p>
    </div>
    <div class="methods-card">
      <h3>This panel</h3>
      <dl class="methods-kv">
        <dt>panel</dt><dd>${esc(PANELS[S.panel].name)}, ${esc(PANELS[S.panel].span)}</dd>
        <dt>nodes</dt><dd>${m.n_nodes} — ${esc(kindLine)}${nStructural ? ` · ${nStructural} structural (source-only)` : ""}</dd>
        <dt>edges</dt><dd>${m.n_edges_majority} retained in at least two of three fits · ${m.n_edges_consensus} in all three · ${m.n_edges_positive} positive · ${m.n_edges_negative} negative · ${m.n_edges_weak_sign} weakly signed</dd>
        <dt>matrix order</dt><dd>${o.n_blocks || (o.blocks || []).length} groups · modularity ${fmt(cc.observed, 3)} against ${fmt(cc.rewired_mean, 3)} in randomly rewired graphs of the same density</dd>
        ${fman ? `<dt>forecasts</dt><dd>${fman.n_countries || ""} countries · issued from ${fman.last_observed_year} · horizons ${(fman.horizons || []).join(", ")} years · validated ${(fman.validated_horizons || []).join(", ")}${fman.not_forecast && fman.not_forecast.nodes && fman.not_forecast.nodes.length ? ` · ${fman.not_forecast.nodes.length} structural nodes not forecast` : ""}</dd>` : ""}
      </dl>
      ${["measurement", "index", "edge_selection", "edge_sign", "matrix_order", "effect_curves", "forecasts", "dynamics"].filter((k) => sentence(p[k])).map((k) => `<p class="footnote">${esc(sentence(p[k]))}</p>`).join("")}
    </div>
    ${sections}
    ${evalTable}
    <div class="methods-card">
      <h3>Node naming</h3>
      <p>Observed indicators display their V-Dem Codebook v15 names. Latent factors are theoretical constructs from the confirmatory measurement model; each displays the construct name assigned by the lab, and its member indicators are listed in its neighborhood view on the Structure page. Factor numbering is panel-specific.</p>
    </div>
    <div class="methods-card">
      <h3>References</h3>
      ${M.references_note ? `<p class="footnote">${esc(M.references_note)}</p>` : ""}
      <ol class="refs">${(M.references || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
    </div>
    <div class="methods-card">
      <h3>Data &amp; citation</h3>
      <p>Primary data: Varieties of Democracy (V-Dem) dataset v15, DOI <a href="https://doi.org/10.23696/vdemds25">10.23696/vdemds25</a>.${S.panel === "modern_factors" ? " The Modern panel additionally incorporates Maddison Project, World Bank World Development Indicators, UN World Population Prospects, and KOF Globalisation Index covariates." : ""}</p>
      <p>Analysis: AIM-3D Lab (AI-based Modeling of Democratic Development and Decline), Lucy Family Institute for Data &amp; Society, University of Notre Dame. This explorer serves precomputed pipeline artifacts; it computes no new statistics.</p>
    </div>`;
}

/* ─────────────────────── Router / init ──────────────────── */

const VIEWS = ["structure", "edges", "ice", "forecasts", "whatif", "guide", "methods"];

async function showView(view) {
  if (!VIEWS.includes(view)) view = "structure";
  S.view = view;
  document.querySelectorAll(".rail-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.view === view));
  VIEWS.forEach((v) => { const elv = $(`view-${v}`); if (elv) elv.hidden = v !== view; });

  await loadPanel(S.panel);
  if (view === "structure") renderStructure();
  else if (view === "edges") renderEdges();
  else if (view === "ice") { populateIceSelect(); renderICE(); }
  else if (view === "forecasts") renderForecasts();
  else if (view === "whatif") renderWhatIf();
  else if (view === "guide") renderGuide();
  else if (view === "methods") renderMethods();
  annotateView(`view-${view}`);
}

async function switchPanel(panel) {
  if (!(panel in PANELS)) return;
  S.panel = panel;
  S.egoNode = null;
  document.querySelectorAll(".panel-tag").forEach((b) =>
    b.classList.toggle("active", b.dataset.panel === panel));
  await showView(S.view);
}

function init() {
  document.querySelectorAll(".panel-tag").forEach((b) =>
    b.addEventListener("click", () => switchPanel(b.dataset.panel)));
  window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
  $("matrix-majority").addEventListener("change", renderStructure);
  $("edges-consensus-only").addEventListener("change", renderEdges);
  $("edges-sign").addEventListener("change", renderEdges);
  $("edges-search").addEventListener("input", renderEdges);
  $("ice-edge").addEventListener("change", renderICE);
  $("fc-country").addEventListener("change", (e) => { S.fcCountry = +e.target.value; renderForecasts(); });
  $("fc-node").addEventListener("change", (e) => { S.fcNode = e.target.value; renderForecasts(); });
  $("fc-h").addEventListener("change", (e) => { S.fcH = e.target.value; renderForecasts(); });
  $("wi-scope").addEventListener("change", (e) => { S.wiScope = e.target.value; renderWhatIf(); });
  $("wi-country").addEventListener("change", (e) => { S.wiCountry = +e.target.value; renderWhatIf(); });
  $("wi-shock").addEventListener("change", (e) => { S.wiShock = e.target.value; renderWhatIf(); });
  $("wi-dir").addEventListener("change", (e) => { S.wiDir = e.target.value; renderWhatIf(); });
  $("wi-h").addEventListener("change", (e) => { S.wiH = e.target.value; renderWhatIf(); });
  $("fc-btn-accuracy").addEventListener("click", () => {
    const b = $("fc-accuracy"); b.hidden = !b.hidden;
    $("fc-btn-accuracy").setAttribute("aria-expanded", String(!b.hidden));
    if (!b.hidden) b.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.querySelectorAll(".panel-tag").forEach((b) =>
    b.classList.toggle("active", b.dataset.panel === S.panel));
  attachTermTooltips();
  const stamp = $("build-stamp");
  if (stamp) stamp.textContent = `Explorer build ${BUILD}`;
  showView(location.hash.slice(1) || "structure");
}

window.S = S;
document.addEventListener("DOMContentLoaded", init);


/* ─────────────────────── View: Forecasts ─────────────────── */

const H_LABEL = { "1": "1 year", "3": "3 years", "5": "5 years", "10": "10 years (not validated)" };
const BAND_NOTE = "The band is a nominal 90% band; in the evaluation period it held the outcome 80 to 87% of the time at 1, 3 and 5 years. It is not calibrated.";

async function renderForecasts() {
  const d = S.data[S.panel];
  const byId = nodeById(d);
  const [idx, man] = await Promise.all([loadCountryIndex(S.panel), loadForecastManifest(S.panel)]);
  const countries = [...idx.countries].sort((a, b) => a.name.localeCompare(b.name));

  // Country selector (by name; the file is keyed by country_id)
  const cSel = $("fc-country");
  if (cSel.dataset.panel !== S.panel) {
    cSel.innerHTML = countries.map((c) => `<option value="${c.country_id}">${esc(c.name)}</option>`).join("");
    cSel.dataset.panel = S.panel;
    if (!countries.some((c) => c.country_id === S.fcCountry)) S.fcCountry = countries[0].country_id;
  }
  cSel.value = String(S.fcCountry);
  const entry = countries.find((c) => c.country_id === S.fcCountry) || countries[0];

  // Node selector: every node; the not-forecast ones are labelled
  const nf = new Set((man.not_forecast && man.not_forecast.nodes) || []);
  const nSel = $("fc-node");
  if (nSel.dataset.panel !== S.panel) {
    const ids = alphaNodeIds(d);
    nSel.innerHTML = ids.map((id) => {
      const n = byId[id];
      return `<option value="${esc(id)}">${esc(n ? n.label : id)}${nf.has(id) ? " (not forecast)" : ""}</option>`;
    }).join("");
    nSel.dataset.panel = S.panel;
    if (!ids.includes(S.fcNode) || nf.has(S.fcNode)) S.fcNode = ids.find((id) => !nf.has(id));
  }
  nSel.value = S.fcNode;
  $("fc-h").value = S.fcH;

  const node = byId[S.fcNode];
  const label = node ? node.label : S.fcNode;

  // Structural nodes: no chart
  if (nf.has(S.fcNode)) {
    $("fc-charts").hidden = true;
    $("fc-notforecast").hidden = false;
    $("fc-notforecast").innerHTML =
      `<h3>Not forecast: structural</h3><p class="validation-note">${esc(label)} is ${esc((man.not_forecast && man.not_forecast.reason) || "a structural variable and is not forecast")}.</p>`;
    await renderAccuracyBlock(entry, null);
    return;
  }
  $("fc-notforecast").hidden = true;
  $("fc-charts").hidden = false;

  const C = await loadForecastFile(S.panel, entry);
  if (!C || !C.fans || !C.fans[S.fcNode]) {
    $("fc-charts").hidden = true;
    $("fc-notforecast").hidden = false;
    $("fc-notforecast").innerHTML = `<h3>No forecast file</h3><p class="validation-note">No forecast file is available for ${esc(entry.name)}.</p>`;
    return;
  }
  drawWalkForward(C, label);
  drawForward(C, label);
  await renderAccuracyBlock(entry, C);
}

/* Chart 1 — forecasts made along the way, for one horizon, over observed. */
function drawWalkForward(C, label) {
  const node = S.fcNode, h = S.fcH, hi = +h;
  const obs = C.observed[node] || [];
  const obsMap = {}; obs.forEach(([y, v]) => (obsMap[y] = v));
  const rows = (C.fans[node] && C.fans[node][h]) || [];
  const pts = rows.map(([origin, q05, q50, q95]) => ({ t: origin + hi, origin, q05, q50, q95, actual: obsMap[origin + hi] }))
    .sort((a, b) => a.t - b.t);
  const withOutcome = pts.filter((p) => p.actual !== undefined);
  const pending = pts.filter((p) => p.actual === undefined);

  $("fc-title-walk").textContent = `Forecasts made along the way — ${label}, ${H_LABEL[h]}`;
  const ys = obs.map((o) => o[1]).concat(pts.flatMap((p) => [p.q05, p.q95]));
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const pad = (ymax - ymin) * 0.1 || 0.1;
  const xs = obs.map((o) => o[0]).concat(pts.map((p) => p.t));
  const f = chartFrame($("fc-walk-chart"), {
    xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: ymin - pad, ymax: ymax + pad,
    xlabel: "Year the forecast was for", ylabel: `${label} (panel units)`,
    xticks: (() => { const t = []; for (let y = Math.ceil(Math.min(...xs) / 5) * 5; y <= Math.max(...xs); y += 5) t.push(y); return t; })(),
  });
  // last observed year marker
  f.svg.appendChild(el("line", { x1: f.x(C.last_observed_year), x2: f.x(C.last_observed_year), y1: f.m.top, y2: f.H - f.m.bottom, stroke: "#b8bdc7", "stroke-dasharray": "3 3" }));
  // 90% band: scored part solid, pending part faded
  if (withOutcome.length > 1) addBand(f, withOutcome.map((p) => p.t), withOutcome.map((p) => p.q05), withOutcome.map((p) => p.q95), "#2456c4", 0.16);
  if (pending.length) {
    const seg = (withOutcome.length ? [withOutcome[withOutcome.length - 1]] : []).concat(pending);
    if (seg.length > 1) addBand(f, seg.map((p) => p.t), seg.map((p) => p.q05), seg.map((p) => p.q95), "#2456c4", 0.07);
  }
  // forecast medians
  if (withOutcome.length) addLine(f, withOutcome.map((p) => [p.t, p.q50]), "#2456c4", { width: 2 });
  if (pending.length) {
    const seg = (withOutcome.length ? [withOutcome[withOutcome.length - 1]] : []).concat(pending);
    addLine(f, seg.map((p) => [p.t, p.q50]), "#2456c4", { width: 2, dash: "5 4", opacity: 0.6 });
  }
  pts.forEach((p) => f.svg.appendChild(el("circle", {
    cx: f.x(p.t), cy: f.y(p.q50), r: 2.6,
    fill: p.actual === undefined ? "#ffffff" : "#2456c4", stroke: "#2456c4", "stroke-width": 1.4,
    "data-tip": `${label}, forecast for ${p.t} made in ${p.origin}\u0001median ${fmt(p.q50, 3)} · band ${fmt(p.q05, 3)} to ${fmt(p.q95, 3)}` +
      (p.actual === undefined ? "\nOutcome not yet observed" : `\nObserved ${fmt(p.actual, 3)} · ${p.actual >= p.q05 && p.actual <= p.q95 ? "inside" : "outside"} the band`),
  })));
  // observed
  if (obs.length) addLine(f, obs.map(([y, v]) => [y, v]), "#16233b", { width: 2.2 });
  attachMatrixTooltip($("fc-walk-chart").parentElement);

  const inside = withOutcome.filter((p) => p.actual >= p.q05 && p.actual <= p.q95).length;
  $("fc-walk-legend").innerHTML =
    `<span class="key"><span class="key-line" style="border-color:#16233b"></span>observed</span>` +
    `<span class="key"><span class="key-line" style="border-color:#2456c4"></span>forecast median (${H_LABEL[h]} ahead)</span>` +
    `<span class="key"><span class="key-band" style="background:#2456c4;opacity:.18"></span>nominal 90% band</span>` +
    `<span class="key"><span class="key-line dashed" style="border-color:#2456c4;opacity:.6"></span>outcome not yet observed</span>` +
    (withOutcome.length ? `<span class="key">${inside} of ${withOutcome.length} scored forecasts fell inside the band</span>` : "");
  $("fc-walk-note").textContent =
    `Each point is the forecast of ${label} ${H_LABEL[h]} ahead, made in the year the information was available (origins ${C.scope || ""}), placed at the year it was for. ` +
    BAND_NOTE + (h === "10" ? " Ten-year forecasts are published without validation." : "") +
    ` Hover any point for the forecast and the outcome.`;
}

/* Chart 2 — the production forecast issued from the last observed year. */
function drawForward(C, label) {
  const node = S.fcNode;
  const obs = (C.observed[node] || []).slice(-15);
  const fc = C.forecast[node] || {};
  const hs = ["1", "3", "5", "10"].filter((h) => fc[h]);
  const rows = hs.map((h) => ({ h, year: fc[h][0], q05: fc[h][1], q25: fc[h][2], q50: fc[h][3], q75: fc[h][4], q95: fc[h][5] }));
  const last = C.observed[node] ? C.observed[node][C.observed[node].length - 1] : null;
  $("fc-title-fwd").textContent = `Forecast from ${C.last_observed_year} — ${label}`;

  const ys = obs.map((o) => o[1]).concat(rows.flatMap((r) => [r.q05, r.q95]));
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const pad = (ymax - ymin) * 0.12 || 0.1;
  const xmin = obs.length ? obs[0][0] : C.last_observed_year - 5;
  const xmax = rows.length ? rows[rows.length - 1].year : C.last_observed_year + 10;
  const f = chartFrame($("fc-fwd-chart"), {
    xmin, xmax, ymin: ymin - pad, ymax: ymax + pad,
    xlabel: "Year", ylabel: `${label} (panel units)`,
    xticks: (() => { const t = []; for (let y = Math.ceil(xmin / 5) * 5; y <= xmax; y += 5) t.push(y); return t; })(),
  });
  // unvalidated region (beyond the last validated horizon target)
  const vmax = Math.max(...(C.validated_horizons || [5]));
  const vEnd = C.last_observed_year + vmax;
  f.svg.appendChild(el("rect", { x: f.x(vEnd), y: f.m.top, width: Math.max(0, f.x(xmax) - f.x(vEnd)), height: f.H - f.m.top - f.m.bottom, fill: "#f6f0ee" }));
  f.svg.appendChild(el("text", { x: f.x(vEnd) + 6, y: f.m.top + 14, "font-size": 10.5, fill: "#b3372e", "font-family": "IBM Plex Mono, monospace" }, "not validated"));
  f.svg.appendChild(el("line", { x1: f.x(C.last_observed_year), x2: f.x(C.last_observed_year), y1: f.m.top, y2: f.H - f.m.bottom, stroke: "#b8bdc7", "stroke-dasharray": "3 3" }));
  // bands anchored at the last observed value
  const anchor = last ? [{ year: last[0], q05: last[1], q25: last[1], q50: last[1], q75: last[1], q95: last[1] }] : [];
  const seq = anchor.concat(rows);
  if (seq.length > 1) {
    addBand(f, seq.map((r) => r.year), seq.map((r) => r.q05), seq.map((r) => r.q95), "#2456c4", 0.12);
    addBand(f, seq.map((r) => r.year), seq.map((r) => r.q25), seq.map((r) => r.q75), "#2456c4", 0.2);
    addLine(f, seq.map((r) => [r.year, r.q50]), "#2456c4", { width: 2.2 });
  }
  if (obs.length) addLine(f, obs.map(([y, v]) => [y, v]), "#16233b", { width: 2.2 });
  rows.forEach((r) => f.svg.appendChild(el("circle", {
    cx: f.x(r.year), cy: f.y(r.q50), r: 3, fill: "#2456c4",
    "data-tip": `${label}, ${H_LABEL[r.h]} ahead (${r.year})\u0001median ${fmt(r.q50, 3)} · middle half ${fmt(r.q25, 3)} to ${fmt(r.q75, 3)} · band ${fmt(r.q05, 3)} to ${fmt(r.q95, 3)}` + (r.h === "10" ? "\nPublished without validation" : ""),
  })));
  attachMatrixTooltip($("fc-fwd-chart").parentElement);

  $("fc-fwd-legend").innerHTML =
    `<span class="key"><span class="key-line" style="border-color:#16233b"></span>observed</span>` +
    `<span class="key"><span class="key-line" style="border-color:#2456c4"></span>forecast median</span>` +
    `<span class="key"><span class="key-band" style="background:#2456c4;opacity:.22"></span>middle half (q25–q75)</span>` +
    `<span class="key"><span class="key-band" style="background:#2456c4;opacity:.12"></span>nominal 90% band</span>`;

  // Large-move probabilities for the forward forecast
  const lm = (C.large_move_forecast && C.large_move_forecast[node]) || {};
  const thr = C.large_move_threshold ? C.large_move_threshold[node] : null;
  let html = `<table class="data-table"><thead><tr><th>Horizon</th><th>Year</th><th>P(large fall)</th><th>P(large rise)</th></tr></thead><tbody>`;
  hs.forEach((h) => {
    const r = lm[h]; if (!r) return;
    html += `<tr><td>${esc(H_LABEL[h])}</td><td class="mono">${r[0]}</td><td class="mono">${fmt(r[1], 3)}</td><td class="mono">${fmt(r[2], 3)}</td></tr>`;
  });
  $("fc-largemove").innerHTML = html + "</tbody></table>";
  const modernPast = C.last_observed_year < new Date().getFullYear() - 1 && rows.some((r) => r.year <= new Date().getFullYear());
  $("fc-fwd-note").textContent =
    `A large move is a change of more than half a standard deviation of this variable's level` + (thr !== null ? ` (${fmt(thr, 3)} here)` : "") +
    ". Fall probabilities are informative at every validated horizon; rise probabilities at one year and only weakly beyond. " +
    BAND_NOTE +
    (modernPast ? ` Issued from ${C.last_observed_year}: targets already past are shown as issued.` : "");
}

/* Accuracy: node by horizon, the country's own row, and the panel overall. */
async function renderAccuracyBlock(entry, C) {
  const acc = await loadAccuracy(S.panel);
  const block = $("fc-accuracy");
  if (!acc) { block.innerHTML = ""; return; }
  const d = S.data[S.panel]; const byId = nodeById(d);
  const node = S.fcNode; const label = byId[node] ? byId[node].label : node;
  const hs = ["1", "3", "5", "10"];
  const hLab = (h) => (h === "10" ? "10 years (not validated)" : H_LABEL[h]);
  const row = (h, r) => r ? `<tr><td>${hLab(h)}</td><td class="mono">${r.n ?? r[0]}</td><td class="mono">${fmt(r.mae ?? r[1], 4)}</td><td class="mono">${fmt(r.mae_persistence ?? r[2], 4)}</td><td class="mono">${fmt(r.error_pct_of_range ?? r[3], 2)}%</td><td class="mono">${fmt(r.error_pct_of_range_persistence ?? r[4], 2)}%</td></tr>` : "";
  const head = `<thead><tr><th>Horizon</th><th>n</th><th>MAE</th><th>MAE, no change</th><th>Error, % of range</th><th>No change, % of range</th></tr></thead>`;

  const byH = (acc.nodes[node] && acc.nodes[node].by_h) || {};
  const nodeTbl = `<h4>${esc(label)}, all countries</h4><table class="data-table">${head}<tbody>${hs.map((h) => row(h, byH[h])).join("")}</tbody></table>`;

  const cRows = acc.countries[String(entry.country_id)] || acc.countries[entry.country_id];
  const cNode = cRows && cRows[node];
  const countryTbl = cNode
    ? `<h4>${esc(label)}, ${esc(entry.name)}</h4><table class="data-table">${head}<tbody>${hs.map((h) => row(h, cNode[h])).join("")}</tbody></table>`
    : `<h4>${esc(label)}, ${esc(entry.name)}</h4><p class="validation-note">No country figure: fewer than ${acc.min_forecasts_per_country_figure || 3} forecasts could be scored.</p>`;

  const overall = `<h4>All variables, this panel</h4><table class="data-table"><thead><tr><th>Horizon</th><th>Forecasts scored</th><th>Error, % of range</th><th>No change, % of range</th><th>MAE against no change</th></tr></thead><tbody>` +
    acc.overall.map((o) => `<tr><td>${hLab(String(o.h))}</td><td class="mono">${o.forecasts}</td><td class="mono">${fmt(o.error_pct_of_range, 2)}%</td><td class="mono">${fmt(o.error_pct_of_range_persistence, 2)}%</td><td class="mono">${fmt(o.mae_vs_persistence, 3)}</td></tr>`).join("") +
    `</tbody></table>`;

  block.innerHTML =
    `<h3>Forecast accuracy</h3>` +
    `<p class="validation-note">Mean absolute error of the published forecast median against the value observed at origin + h, for forecasts made from each origin year with the information available then, shown in the variable's own units beside the same error for a no-change forecast. These variables change slowly, so any forecast, including no change, scores well; the forecast's margin over no change is small and narrows with horizon, and for some variables the point forecast is behind no change. Figures are for forecasts made from ${esc(acc.evaluation_origins || "2006")}.</p>` +
    `<div class="validation-tables">${nodeTbl}${countryTbl}</div>${overall}`;
}


/* ─────────────────────── View: What if ─────────────────────── */

const WI_H = ["1", "3", "5", "10"];
const WI_HLAB = { "1": "1 year", "3": "3 years", "5": "5 years", "10": "10 years (not validated)" };

async function renderWhatIf() {
  const d = S.data[S.panel];
  const byId = nodeById(d);
  const [idx, A] = await Promise.all([loadCountryIndex(S.panel), loadWhatIfAggregate(S.panel)]);
  const withFile = [...idx.countries].filter((c) => c.whatif_file).sort((a, b) => a.name.localeCompare(b.name));
  const without = idx.countries.length - withFile.length;

  $("wi-scope").value = S.wiScope;
  $("wi-dir").value = S.wiDir;
  $("wi-h").value = S.wiH;
  $("wi-country-wrap").hidden = S.wiScope !== "country";

  const cSel = $("wi-country");
  if (cSel.dataset.panel !== S.panel) {
    cSel.innerHTML = withFile.map((c) => `<option value="${c.country_id}">${esc(c.name)}</option>`).join("");
    cSel.dataset.panel = S.panel;
    if (!withFile.some((c) => c.country_id === S.wiCountry)) S.wiCountry = withFile[0].country_id;
  }
  cSel.value = String(S.wiCountry);
  const entry = withFile.find((c) => c.country_id === S.wiCountry) || withFile[0];

  // Shock selector: every node; status suffix tells the reader what to expect.
  const src = S.wiScope === "country" ? await loadWhatIfFile(S.panel, entry) : A;
  if (!src) {
    $("wi-charts").hidden = true;
    $("wi-status").hidden = false;
    $("wi-status").innerHTML = `<h3>No what-if file</h3><p class="validation-note">No what-if responses are available for ${esc(entry.name)}.</p>`;
    $("wi-def").textContent = "";
    return;
  }
  const notShocked = new Set(src.not_shocked || []);
  const ns = src.not_supported || {};
  const moves = src.observed_moves || {};
  const dirKey = S.wiDir === "rise" ? "shocks" : "shocks_fall";
  const supported = (id) => !!(src[dirKey] && src[dirKey][id]);

  const sSel = $("wi-shock");
  const ids = alphaNodeIds(d);
  const sKey = `${S.panel}/${S.wiScope}/${S.wiDir}`;
  if (sSel.dataset.key !== sKey) {
    sSel.innerHTML = ids.map((id) => {
      const n = byId[id];
      const suffix = notShocked.has(id) ? " (structural: not moved)" : (supported(id) ? "" : " (not enough observed moves)");
      return `<option value="${esc(id)}">${esc(n ? n.label : id)}${suffix}</option>`;
    }).join("");
    sSel.dataset.key = sKey;
    if (!ids.includes(S.wiShock)) S.wiShock = ids.find((id) => supported(id));
  }
  sSel.value = S.wiShock;
  const shock = S.wiShock;
  const label = byId[shock] ? byId[shock].label : shock;
  const mv = moves[shock] || {};
  const nObs = S.wiDir === "rise" ? mv.rises_observed : mv.falls_observed;

  $("wi-def").textContent = src.definition || "";

  // States: structural, unsupported, or shown
  if (notShocked.has(shock)) {
    $("wi-charts").hidden = true; $("wi-status").hidden = false;
    $("wi-status").innerHTML = `<h3>Not moved: structural</h3><p class="validation-note">${esc(label)} varies almost only between countries and does not make large moves within a country, so no what-if is computed for it.</p>`;
    return;
  }
  if (!supported(shock)) {
    $("wi-charts").hidden = true; $("wi-status").hidden = false;
    const n = nObs === undefined ? "fewer than " + (src.min_support || 20) : String(nObs);
    $("wi-status").innerHTML = `<h3>Not enough observed moves of this size</h3><p class="validation-note">A one-year ${S.wiDir} of half a standard deviation in ${esc(label)} has been observed ${esc(n)} times in the panel (minimum ${src.min_support || 20}). The forecaster has not seen enough such moves for a response to be shown.</p>`;
    return;
  }
  $("wi-status").hidden = true; $("wi-charts").hidden = false;

  const rec = src[dirKey][shock];
  const H = src.horizons || [1, 3, 5, 10];
  const evidence = nObs !== undefined ? `Based on ${nObs} observed ${S.wiDir}s of this size.` : "";

  if (S.wiScope === "country") drawOwnPathCountry(src, rec, shock, label, H, entry);
  else drawOwnPathAggregate(src, rec, shock, label, H);
  drawResponses(src, rec, shock, label, H, byId, S.wiScope === "aggregate" ? A : null);

  $("wi-own-note").textContent =
    (S.wiScope === "country"
      ? `${esc(entry.name)}, from its last observed year (${src.state_year}). `
      : `Mean across the ${src.n_countries} countries observed in the panel's last year (${src.state_year}). `) +
    evidence + " A large move is expected to persist: typically the forecast gives back little of it within the validated horizons.";
}

function drawOwnPathCountry(src, rec, shock, label, H, entry) {
  const base = src.baseline[shock], lo = src.baseline_q05[shock], hi = src.baseline_q95[shock];
  const shocked = rec.shocked[shock];
  $("wi-title-own").textContent = `${label} after a ${S.wiDir} of half a standard deviation — ${entry.name}`;
  const ys = base.concat(lo, hi, shocked);
  const ymin = Math.min(...ys), ymax = Math.max(...ys), pad = (ymax - ymin) * 0.15 || 0.1;
  const f = chartFrame($("wi-own-chart"), {
    xmin: 0, xmax: H[H.length - 1], ymin: ymin - pad, ymax: ymax + pad,
    xlabel: "Years ahead", ylabel: `${label} (standardized)`, xticks: [0].concat(H),
  });
  const vmax = Math.max(...(src.validated_horizons || [5]));
  f.svg.appendChild(el("rect", { x: f.x(vmax), y: f.m.top, width: Math.max(0, f.x(H[H.length - 1]) - f.x(vmax)), height: f.H - f.m.top - f.m.bottom, fill: "#f6f0ee" }));
  f.svg.appendChild(el("text", { x: f.x(vmax) + 6, y: f.m.top + 14, "font-size": 10.5, fill: "#b3372e", "font-family": "IBM Plex Mono, monospace" }, "not validated"));
  addBand(f, H, lo, hi, "#16233b", 0.12);
  addLine(f, H.map((h, i) => [h, base[i]]), "#16233b", { width: 2.2 });
  addLine(f, H.map((h, i) => [h, shocked[i]]), S.wiDir === "rise" ? SIGN.pos : SIGN.neg, { width: 2.2, dash: "6 4" });
  H.forEach((h, i) => f.svg.appendChild(el("circle", {
    cx: f.x(h), cy: f.y(shocked[i]), r: 3, fill: S.wiDir === "rise" ? SIGN.pos : SIGN.neg,
    "data-tip": `${label}, ${WI_HLAB[String(h)]}\u0001baseline ${fmt(base[i], 3)} · after the move ${fmt(shocked[i], 3)} · change ${fmt(shocked[i] - base[i], 3)}`,
  })));
  attachMatrixTooltip($("wi-own-chart").parentElement);
  $("wi-own-legend").innerHTML =
    `<span class="key"><span class="key-line" style="border-color:#16233b"></span>published forecast (baseline)</span>` +
    `<span class="key"><span class="key-band" style="background:#16233b;opacity:.12"></span>baseline 90% band</span>` +
    `<span class="key"><span class="key-line dashed" style="border-color:${S.wiDir === "rise" ? SIGN.pos : SIGN.neg}"></span>forecast after the move</span>`;
}

function drawOwnPathAggregate(src, rec, shock, label, H) {
  // Aggregate files carry responses, not baselines: show the mean own-response with its spread.
  const resp = rec[shock];
  const p10 = src.shocks_p10 && (S.wiDir === "rise" ? src.shocks_p10 : src.shocks_fall_p10)[shock];
  const p90 = src.shocks_p90 && (S.wiDir === "rise" ? src.shocks_p90 : src.shocks_fall_p90)[shock];
  const lo = p10 ? p10[shock] : null, hi = p90 ? p90[shock] : null;
  $("wi-title-own").textContent = `${label}: how much of the move remains in its own forecast — average across countries`;
  const ys = resp.concat(lo || [], hi || [], [0]);
  const ymin = Math.min(...ys), ymax = Math.max(...ys), pad = (ymax - ymin) * 0.15 || 0.05;
  const f = chartFrame($("wi-own-chart"), {
    xmin: 0, xmax: H[H.length - 1], ymin: ymin - pad, ymax: ymax + pad,
    xlabel: "Years ahead", ylabel: "Change in own forecast (standardized)", xticks: [0].concat(H),
  });
  const vmax = Math.max(...(src.validated_horizons || [5]));
  f.svg.appendChild(el("rect", { x: f.x(vmax), y: f.m.top, width: Math.max(0, f.x(H[H.length - 1]) - f.x(vmax)), height: f.H - f.m.top - f.m.bottom, fill: "#f6f0ee" }));
  f.svg.appendChild(el("line", { x1: f.m.left, x2: f.W - f.m.right, y1: f.y(0), y2: f.y(0), stroke: "#b8bdc7", "stroke-dasharray": "3 3" }));
  if (lo && hi) addBand(f, H, lo, hi, "#6b7486", 0.15);
  addLine(f, H.map((h, i) => [h, resp[i]]), S.wiDir === "rise" ? SIGN.pos : SIGN.neg, { width: 2.2 });
  $("wi-own-legend").innerHTML =
    `<span class="key"><span class="key-line" style="border-color:${S.wiDir === "rise" ? SIGN.pos : SIGN.neg}"></span>mean change across countries</span>` +
    (lo ? `<span class="key"><span class="key-band" style="background:#6b7486;opacity:.15"></span>10th–90th percentile across countries</span>` : "");
}

/* Ranked responses of other variables at the chosen horizon. */
function drawResponses(src, rec, shock, label, H, byId, A) {
  const h = S.wiH, hi = H.indexOf(+h);
  const resp = S.wiScope === "country" ? rec.response : rec;   // aggregate rec is the response map itself
  const p10 = A ? (S.wiDir === "rise" ? A.shocks_p10 : A.shocks_fall_p10)[shock] : null;
  const p90 = A ? (S.wiDir === "rise" ? A.shocks_p90 : A.shocks_fall_p90)[shock] : null;
  const rows = Object.keys(resp).filter((k) => k !== shock)
    .map((k) => ({ id: k, v: resp[k][hi], lo: p10 && p10[k] ? p10[k][hi] : null, hi: p90 && p90[k] ? p90[k][hi] : null }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const top = rows.slice(0, 14);
  const nAbove = rows.filter((r) => Math.abs(r.v) > 0.05).length;

  $("wi-title-resp").textContent = `How other forecasts change at ${WI_HLAB[h]} — largest ${top.length} of ${rows.length}`;
  const svg = $("wi-resp-chart");
  svg.innerHTML = "";
  const W = svg.clientWidth || 760, Hh = svg.clientHeight || 400;
  const m = { top: 14, right: 70, bottom: 36, left: 230 };
  const ext = Math.max(0.01, ...top.flatMap((r) => [Math.abs(r.v), Math.abs(r.lo || 0), Math.abs(r.hi || 0)]));
  const x = linScale(-ext, ext, m.left, W - m.right);
  const rowH = (Hh - m.top - m.bottom) / Math.max(1, top.length);
  // reference: 0.05 SD, the handoff's "barely responds" threshold
  [-0.05, 0.05].forEach((t) => { if (Math.abs(t) < ext) svg.appendChild(el("line", { x1: x(t), x2: x(t), y1: m.top, y2: Hh - m.bottom, stroke: "#e3d3a8", "stroke-dasharray": "3 3" })); });
  svg.appendChild(el("line", { x1: x(0), x2: x(0), y1: m.top, y2: Hh - m.bottom, stroke: "#2a3342" }));
  x.ticks(5).forEach((t) => {
    svg.appendChild(el("text", { x: x(t), y: Hh - m.bottom + 16, "text-anchor": "middle", "font-size": 10.5, fill: "#6b7486", "font-family": "IBM Plex Mono, monospace" }, fmtTick(t)));
  });
  svg.appendChild(el("text", { x: (m.left + W - m.right) / 2, y: Hh - 4, "text-anchor": "middle", "font-size": 11.5, fill: "#2a3342" }, "Change in the forecast (standardized units)"));
  top.forEach((r, i) => {
    const y = m.top + i * rowH + rowH / 2;
    const n = byId[r.id]; const lab = n ? n.label : r.id;
    const col = r.v >= 0 ? SIGN.pos : SIGN.neg;
    svg.appendChild(el("rect", {
      x: Math.min(x(0), x(r.v)), y: y - rowH * 0.32, width: Math.abs(x(r.v) - x(0)), height: rowH * 0.64, fill: col, opacity: 0.8,
      "data-tip": `${lab}\u0001${r.id}\nchange ${fmt(r.v, 4)} at ${WI_HLAB[h]}` + (r.lo !== null ? `\n10th–90th pct across countries ${fmt(r.lo, 4)} to ${fmt(r.hi, 4)}` : ""),
    }));
    if (r.lo !== null && r.hi !== null) {
      svg.appendChild(el("line", { x1: x(r.lo), x2: x(r.hi), y1: y, y2: y, stroke: "#16233b", "stroke-width": 1.4 }));
      svg.appendChild(el("line", { x1: x(r.lo), x2: x(r.lo), y1: y - 4, y2: y + 4, stroke: "#16233b" }));
      svg.appendChild(el("line", { x1: x(r.hi), x2: x(r.hi), y1: y - 4, y2: y + 4, stroke: "#16233b" }));
    }
    svg.appendChild(el("text", { x: m.left - 8, y: y + 3.5, "text-anchor": "end", "font-size": 11, fill: "#2a3342", "font-family": "IBM Plex Sans, sans-serif" }, lab.length > 34 ? lab.slice(0, 33) + "…" : lab));
    svg.appendChild(el("text", { x: (r.v >= 0 ? x(r.v) + 5 : x(r.v) - 5), y: y + 3.5, "text-anchor": r.v >= 0 ? "start" : "end", "font-size": 10, fill: "#6b7486", "font-family": "IBM Plex Mono, monospace" }, fmt(r.v, 3)));
  });
  attachMatrixTooltip(svg.parentElement);
  $("wi-resp-legend").innerHTML =
    `<span class="key"><span class="key-band" style="background:${SIGN.pos};opacity:.8"></span>forecast moves up</span>` +
    `<span class="key"><span class="key-band" style="background:${SIGN.neg};opacity:.8"></span>forecast moves down</span>` +
    `<span class="key"><span class="key-line dashed" style="border-color:#e3d3a8"></span>±0.05 SD reference</span>` +
    (A ? `<span class="key"><span class="key-line" style="border-color:#16233b"></span>10th–90th percentile across countries</span>` : "");
  $("wi-resp-note").textContent =
    `Of ${rows.length} other variables, ${nAbove} change by more than 0.05 standard deviations at ${WI_HLAB[h]}. ` +
    (A ? "The spread across countries is typically several times the mean response, which is why the view opens on a single country. " : "") +
    "These responses say how the forecaster's prediction changes, not what causes what; they do not confirm or test the edge signs in the Structure view." +
    (h === "10" ? " Ten-year responses are published without validation." : "");
}
