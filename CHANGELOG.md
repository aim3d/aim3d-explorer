# Changelog

The live build id appears in the portal footer and is defined as `BUILD` at
the top of `js/app.js`. The footer stamp was introduced in v12; builds before
that carry no visible marker, so a deployed site showing no stamp is v11 or
earlier.

Deployment is replace-all: the package is the build, and no file in it
requires hand-editing. The one component deployed separately is
`tier3/worker.js`, which is pasted into Cloudflare; the version notes below
say when that needs re-pasting.

---

## v21 — 2026-08-24 · selectable shocks and counterfactual trajectories
Ships Stage 7c `irf_aggregate.json` and Stage 7d `cfact/<country>.json` for
both panels, plus the updated manifests carrying `provenance.irf` and
`provenance.counterfactual_trajectories`.

Dynamics gains a shock selector (every node, structural included) and a scope
selector. The two scopes are different objects and are labelled as such:

- **System response (all countries)** — the invariant response surface. Copy
  states it is state-independent by linearity and therefore identical for
  every country, *not* an average.
- **Country trajectory** — baseline vs shocked paths from that country's last
  observed state, with the L2-norm pair and a signed per-node path beneath it,
  plus a ranked list of the most displaced nodes. Copy states the baseline is
  the linear system's path decaying toward the panel mean, and is **not** the
  validated NAVAR forecast in the Trajectories view.

Verified before packaging: 160 and 138 country files matching the manifests;
shocked − baseline reproduces the aggregate response to 1e-05 across 670,500
values, confirming the linearity claim; L2 norms recompute from the per-node
series to 1.4e-05; structural nodes are shockable (8/8 modern, 40 responders
each including their own path). The shocked norm falls below baseline at some
horizon in 38% of century and 43% of modern country-shock pairs — the
published Peru case reproduces (Peru + party competition across regions), and
the legend flags it, which is why signed per-node paths sit alongside the norm
rather than the norm standing alone.

Also fixed: the ρ chart now states that the spectral radius is a property of
the whole system and does not vary with the node chips above it, and those
chips are relabelled "Series shown in this chart". The earlier layout implied
they controlled ρ and the IRF, which they never did.

## v20 — 2026-08-24 · network layout replaced
The ring-and-chords layout was hard to read as edge count grew. Replaced with
a proper graph layout plus density controls.

- **Layout: stress majorization (SMACOF) on graph-theoretic distances** — the
  Kamada–Kawai objective. Densely connected variables land near one another,
  so clusters carry structural meaning. Seeded circularly with a fixed
  iteration count, so positions are deterministic: the same node always lays
  out the same way. Verified minimum node separation 68–99 px across the
  worst cases (modern F03 at 24 nodes / 82 edges, century v2svstterr at
  19 / 77).
- Edges are straight paths with arrowheads; reciprocal pairs bow apart so
  both directions stay visible.
- **Visual hierarchy:** the focus node's own edges are drawn at full strength,
  edges among neighbours at roughly half — measured 0.66 vs 0.26 mean opacity
  on modern F03.
- **Hover isolation:** hovering any node fades everything not incident to it
  (82 edges down to the 7 that touch the hovered node in the F03 case).
  Crossings are unavoidable at this density under any layout, so isolation
  does the work that geometry cannot.
- Labels carry a paper-coloured halo so overlaps stay legible.

## v19 — 2026-08-24 · ego network view
The Structure tab's neighbourhood panel gains a Table/Network toggle. The
network draws the induced subgraph on the focus node and its neighbours —
including edges *among* the neighbours, which the table cannot show.

- Layout: focus at centre, neighbours on a ring ordered by relation to the
  focus (incoming, both, outgoing) and then by score. Focus edges are radial
  spokes; neighbour-to-neighbour edges are chords curved toward the centre.
  Arrowheads carry direction; thickness and opacity encode the causal score.
- Edge classes are visually distinct: consensus blue, majority-only grey,
  aggregation-adjacent amber. Structural (source-only) nodes are drawn hollow
  grey with the ICC tooltip.
- The network mirrors the **table's** edge set (all retained edges) rather
  than the matrix's consensus filter, so the two views of the same node never
  report different counts. Verified: polyarchy shows 13 incoming + 5 outgoing
  in both, plus 52 edges among neighbours visible only in the network.
- Clicking any neighbour recentres the network on it; hovering any edge or
  node gives the same tooltip detail as the matrix.
- Largest cases render cleanly: century `v2svstterr` (19 nodes) and modern
  `F03` (23 nodes).

## v18 — 2026-08-24 · corrected bundles installed
Ships the Stage 6/7/7b v2 re-export for both panels. Verified before
packaging: all twenty validation figures reproduce the handoff table exactly;
manifest edge counts agree with `edges.json` (century 152/112/3, modern
241/182/3); every edge endpoint and ICE key resolves to a node; no edge
targets a structural node; `nodes.json[].forecast === false` agrees exactly
with `role !== "dynamic"` (modern: F02, F04, F05, v2stfisccap, v2strenadm,
wb_agri_land_share, wb_pop_density, wpp_sex_ratio_jul); forecast keys equal
the endogenous set (century 29, modern 39); history covers every node
including structural ones, with polyarchy agreeing to 5.0e-05.

- Digests regenerated from the new bundles; the labels overlay still resolves
  for every node in both panels.
- Methods reports the endogenous/structural split and states that accuracy
  figures cover endogenous nodes only.
- **Horizon split source, confirmed:** `forecasts.json` carries no per-row
  `validated` flag by design; that flag lives only in the pipeline-side
  `forecasts.csv` and is not exported. `meta.validated_horizon` (currently 5)
  is the intended single source of truth — horizons at or below it are
  validated, above it unvalidated. The portal has drawn the split from that
  field since v1, which the pipeline session confirms is correct. The handoff
  document's §3 said otherwise and has been corrected.

## v17 — 2026-08-24 · endogenous-only forecasts, portal moved
Code prepared for the re-export; bundles still the old ones. Superseded by
v18, which contains both.

- Portal moved to `https://aim3d.github.io/aim3d-explorer/`. Worker
  `PORTAL_ORIGIN` and `DIGEST_BASE` updated accordingly.
  **Requires re-pasting worker.js into Cloudflare.**
- Trajectories branch on forecast availability: nodes with
  `nodes.json[].forecast === false` (8 structural nodes on the modern panel)
  remain selectable, are labelled "(source-only)" in the picker, and render
  observed history alone — no model line, no ensemble band, no persistence
  reference — with copy explaining why. A node absent from `forecasts.json`
  is treated as expected, not as an error.
- The node picker is built from `nodes.json` rather than from a country's
  forecast keys, so source-only nodes are reachable at all.
- Validation panel opens with the framing supplied by the pipeline session.
  One word changed from their draft: "necessary for prediction" became
  "necessary for forecast accuracy", because the portal's own guardrail test
  cannot distinguish that use of "prediction" from calling a trajectory one.
- `test_history.js` gained six checks covering source-only rendering; it
  edits the bundles in place and restores them afterwards.

## v16 — 2026-08-24 · modern history bundle
Ships `data/modern_factors/history.json` (2.42 MB, 150 countries, 47 nodes).
Both panels now have per-node history; the Trajectories view shows observed
series and a persistence reference for every node.

Verified before packaging: all 138 forecast countries covered, series keys
equal to the node set, zero array length mismatches, 4,895 polyarchy values
agreeing with the bundle's own history to 5.0e-05, polyarchy inside 0-1, and
all 8 structural (source-only) nodes carrying history for every country —
they are not modelled as targets but are still observed.

Standardized moments are looser than century (max |mean| 0.145, max |sd-1|
0.333 vs 0.040/0.034). One node accounts for it: `wb_rural_pop_growth`
reaches -58 SD for Kuwait in 2004, with further extremes in `F08` (Kuwait
1990-91, Rwanda 1994) and `v2ddyrall` (Azerbaijan). These are real demographic
and political shocks in heavy-tailed covariates, not export errors, and the
train-fitted scaler was not fitted on them. The most extreme cases (Kuwait,
Bahrain) fall among the 12 history-only countries and are therefore never
selectable in the portal. Charts for the remaining affected country-node pairs
will show a compressed y-axis around the spike, which is the honest rendering
of the underlying data.

## v15 — 2026-08-24 · verified against the real century history bundle
Ships `data/century_factors/history.json` (3.06 MB, 169 countries, 29 nodes),
generated by pipeline Stage 7b and verified here before packaging: all 160
forecast countries covered, series keys equal to the node set, zero array
length mismatches, standardized nodes at max |mean| 0.040 and max |sd−1| 0.034,
polyarchy inside 0–1, and 8,938 polyarchy values agreeing with the bundle's own
history to 5.0e-05 (the Stage 7 5-dp rounding). Modern panel pending.

- Guard: a country present in the history bundle but absent from
  `forecasts.json` (9 such in the century panel) no longer crashes the
  Trajectories view.
- `test_history.js` moves a real `history.json` aside and restores it instead
  of refusing to run. Restore is idempotent — an earlier version ran twice and
  deleted the file it had just restored.

## v14 — 2026-08-24 · history bundle handling
Consumes the per-node history bundle produced upstream by Stage 7b.

- History is keyed by `country_name`, matching `forecasts.json`. The previous
  build keyed by `segment_key`, which would silently have found no history for
  the 60 multi-segment century countries.
- Observed history renders as separate contiguous runs; a gap in observations
  is never bridged by a line, and an isolated observation renders as a point.
- History window is year-based rather than observation-count-based, so a gap
  cannot pull much older segments into view.
- Persistence overlay anchors on the last observed value of the **forecast
  segment** (parsed from `segment_key`), not the last value of the merged
  series.
- Added `test_history.js`: writes a temporary fixture containing a deliberate
  gap, asserts run-splitting and anchoring, then removes it. Refuses to run if
  a real `history.json` is present.

## v13 — 2026-08-24 · optional history support
- Trajectories lazy-loads `data/{panel}/history.json` when present; falls back
  to polyarchy-only history when absent, so the portal works either way.
- Legend no longer advertises "observed history" and "persistence" for nodes
  that have neither.
- Added `tier3/make_history.py` (content-based panel discovery, unit
  cross-check, standardization diagnostic, write gated on verification) and
  `tier3/diagnose_history.py`.
- Added `tier3/HISTORY_EXPORT_REQUEST.md`, the handoff to the pipeline session.

## v12 — 2026-08-24 · Methods rewrite, build stamp
- Methods & data expanded from a parameter dump to a full account: the six
  pipeline stages with their actual settings, a Limitations section, and
  panel-aware copy (structural nodes, near-permanent shocks, data sources).
- Glossary terms are hoverable throughout Methods prose.
- **Build stamp added to the footer.**

## v11 — 2026-08-24 · Worker config baked in
- `tier3/worker.js` ships with the deployment's real URLs instead of
  placeholders, so re-pasting it can no longer wipe the configuration.
- Test suite lints for placeholder URLs in shipped config files.
- **Requires re-pasting worker.js into Cloudflare.**

## v10 — 2026-08-24 · assistant close button
- Fixed: `#asst-drawer { display: flex }` outranked the browser's
  `[hidden] { display: none }`, so the drawer ignored the hidden attribute.
  The JavaScript had been correct; the CSS was overriding it.
- Added a lint that fails the suite for any element toggled via `hidden` that
  has a `display` rule without a matching `[hidden]` override.

## v9 — 2026-08-24 · assistant scope rule
- Assistant may explain general statistical and methodological concepts from
  its own knowledge in plain language, while everything about this study's
  results still comes only from the digest and glossary.
- Explicit prohibition on reporting statistics the analysis does not produce
  (p-values, confidence intervals).
- Behavior tests 14d–14h added for the boundary.
- **Requires re-pasting worker.js into Cloudflare.**

## v8 — 2026-08-24 · glossary expansion
- Added the "Reading this portal" group (adjacency matrix, nodes and edges,
  source and target, neighborhood view, the two panels, seeds and ensemble,
  democracy terciles, horizon, V-Dem). 17 terms → 26.
- Glossary updates need only a `glossary.json` upload; the Worker fetches it
  live from Pages (10-minute cache).

## v7 — 2026-08-24 · assistant diagnostics
- Failure messages name the cause (network/CORS, digest unavailable, server
  error) instead of a generic string.
- Close handler bound directly to the button; Esc closes the drawer.

## v6 — 2026-08-24 · assistant enabled
- `ASSISTANT_ENDPOINT` set to the deployed Worker URL, making the assistant
  launcher visible.

## v5 — 2026-08-23 · glossary and Reader's guide
- `data/glossary.json` as single source for three surfaces: hover tooltips,
  the new Reader's guide view, and the assistant.
- 17 terms covering methods and quantities.
- Worker sends the glossary alongside the digest.

## v4 — 2026-08-23 · Tier-3 stack
- `tier3/make_digests.py` (per-panel results digests), `tier3/SYSTEM_PROMPT.md`,
  `tier3/worker.js` (Cloudflare proxy), `js/assistant.js` (chat drawer),
  `tier3/behavior_tests.md`.
- Assistant dormant until an endpoint is configured.

## v3 — 2026-08-23 · matrix tooltips
- Instant floating tooltips on the adjacency matrix showing display names,
  replacing slow native `title` tooltips and raw ids.

## v2 — 2026-08-23 · display names
- `data/{panel}/labels.json` overlay applied at load; bundle files untouched.
- 66 names: 50 verified against the V-Dem codebook, 5 fixed by the build
  brief, 11 interpretive factor names.
- `portal_labels.csv` records the provenance of every name.

## v1 — 2026-08-23 · Tier-1 explorer
- Six views (Structure, Edges, Effect curves, Dynamics, Trajectories,
  Methods & data), two-panel switcher, static hosting, no build step.
- Build brief §3–§4 display rules enforced and test-covered.
- `smoke_test.js` headless suite.
