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

## v34 — 2026-10-07 · What-if rebuilt on the causal structure
The forecaster-based what-if view is withdrawn: its responses could not
isolate one variable and carried the edge's sign only about half the time
(the clean-elections example of 7 October, where a rise lowered the
variables it has positive edges into). The replacement reads the response
from the fitted NAVAR contribution behind each edge, so the view and the
matrix agree by construction.

Data: `data/whatif/{panel}/whatif.json` (1.9 and 3.2 MB) replaces
everything under `data/dyn/`, which is removed from the package and should
be deleted from the repository. The view no longer uses `country_index` or
any file named by country. Verified before packaging: edge sets equal
`struct/{panel}/edges.json` exactly, with matching form codes; 152 and 135
countries; null rates 17%/6% and 16%/7% as the note states; typical response
0.008 SD, 90th percentile 0.022. The clean-elections example now reads as
it should (century, all countries, higher: freedom of expression +0.016,
freedom of association +0.014, local government +0.011, legislative
constraints +0.008).

Sign rule, for the record: `rise_mean` has the sign of `edge_direction` for
every non-SC/M edge above the 0.002 noise floor except four century edges
from Age of head of state, all saturating, each with `p10 == p90 == mean`,
i.e. a single country inside the observed range sitting on the flat end of
the curve. Reported upstream; the test excludes single-country means.

View: country (all-countries average first, then by name), variable that
changes (by label), direction (higher / lower), and the matrix's majority
toggle; heading "How other forecasts change"; one bar per edge out of the
source, sorted by size, coloured by the direction of the response, with the
form code beside the target's name and the SC hover sentence. Rule 1:
responses below 0.002 SD are drawn as a neutral tick "no measurable
response", not as a small bar. Rule 2: the axis scales to the largest bar
with a 0.02 SD floor; the fixed ±0.05 reference lines are gone. All-countries
shows the 10th–90th percentile across countries. Nulls are "outside the
observed range", never zero, and a source with only nulls for a country
says so. Captions as specified, including the one-hundredth-of-a-SD
sentence.

Methods: the what-if and functional-form paragraphs from the updated
write-up replace the forecaster-based text (now in the causal structure
section); the direction paragraph is updated. Glossary and digest updated;
the digest's what-if block carries the all-countries means per consensus
edge. Modern digest grows to 177 KB. Tests rewritten for the new data; lints
fail if the app references `dyn/`, `cfact` or `irf_aggregate`.

Changed files: `index.html`, `js/app.js`, `smoke_test.js`, `CHANGELOG.md`,
`data/methods.json`, `data/glossary.json`, `data/digest/*.json`,
`tier3/make_digests.py`, new `data/whatif/{panel}/whatif.json`. **Delete
`data/dyn/` in the repository.** No Worker paste needed (the Worker reads the
digest and methods live).

## v33 — 2026-10-06 · Forecasts view shows one forecast
Per the pipeline note of 6 October (replacing the handoff's spec): the
"Forecasts made along the way" chart is removed, with its legend, caption,
in-band count and the horizon selector. It had placed each past forecast at
the year it was for, so the line was the observed series shifted right by
the horizon — the one-year lag noticed on 4 October — and to the right of
the last observed year it replayed history as if it were the outlook.

The view now shows one chart: the observed series (last 30 years) and the
forecast made from the last observed year at +1, +3, +5 and +10, joined from
the last observed value, with the middle-half and nominal 90% bands and the
ten-year point marked not validated. The large-move table follows, with a
sentence beside the chart whenever the table gives better than even odds of
a large fall or rise at a validated horizon. A country whose record ends
before the origin shows its observed series and "This country's record ends
in [year]; no forecast is issued." Nothing is drawn from `fans` or
`fans_full`; a lint fails if the app references them. The accuracy block is
unchanged. Changed files: `index.html`, `js/app.js`, `smoke_test.js`,
`CHANGELOG.md`.

## v32 — 2026-10-06 · matrix caption carries the key
The caption under the matrix spells out the six shape codes in the sentence
itself (from `form_legend`) instead of pointing to the legend above the
matrix. Changed files: `index.html`, `js/app.js`, `CHANGELOG.md`.

## v31 — 2026-10-06 · relationship shapes in the matrix; text changes
Structure export rerun with functional-form fields (`form`, `form_code`,
`form_agreement`, `curve_direction` per edge; `form_legend`, `form_rule`
at the top; `n_edges_by_form` and `provenance.edge_form` in the manifest).
Verified: form counts equal the manifest and the pipeline note exactly
(century 211 L / 152 ST / 175 T / 94 N / 168 SC / 3 M; modern 309 / 367 /
335 / 187 / 312 / 8); every edge has a code consistent with its form; only
`edges.json` and `manifest.json` changed.

- **Matrix cells print the form code** (L, ST, T, N, SC, M), centred in a
  small monospaced face; two-letter codes fit the 15 px cell. Colour is
  unchanged except that **sign-changing edges are grey with SC** — the form
  decides over `weak_sign`. 80 century and 126 modern edges that were firm
  blue or red are now grey. Majority edges carry codes too. The legend adds
  the six codes from `form_legend`; the hover gives the full form name and
  agreement, e.g. "Saturating (3 of 3 models)".
- **Edges table** gains a Form column and a shape filter; sign-changing
  rows show ± instead of + / −. Columns renamed Source / Target.
- **Effect curves** state the edge's shape and agreement under the chart,
  with a one-line reading for saturating, threshold, sign-changing and
  mixed.
- **Methods** replaces the positive/negative share with the three-way
  statement from `curve_direction` (century 465 rise · 170 fall · 168 change
  sign; modern 695 · 511 · 312) and lists shape counts from the manifest;
  `provenance.edge_form` is shown. The "What changed in this rebuild" card
  is removed from the page and from `methods.json`.
- **Text**: the matrix caption and the Structure and Edges introductions
  rewritten in plain English as approved ("Rows are sources, columns are
  targets…"). Glossary gains a shape entry; the sign entry now describes
  sign-changing edges. Digests carry form code and agreement per edge and a
  framing rule on shapes.
- Note for the record: one modern edge has `sign` and `curve_direction`
  disagreeing; the page uses `curve_direction` for the direction counts, so
  they match the pipeline's figures.

Changed files: `data/struct/{panel}/edges.json`, `data/struct/{panel}/manifest.json`,
`data/digest/*.json`, `data/glossary.json`, `data/methods.json`, `index.html`,
`js/app.js`, `css/style.css`, `smoke_test.js`, `tier3/make_digests.py`,
`CHANGELOG.md`. No Worker paste.

## v30 — 2026-10-06 · plainer view introductions; Edges table fits
The introductions to Effect curves, Forecasts and What if are rewritten as
prose for readers rather than restated rules; the required substance (band
coverage 80–87%, not calibrated; ten years not validated; what-if is
prediction not cause; one country first) is kept. The Edges table no longer
overflows the page: columns are Source, Receiver, Sign, Causal score (range
on hover), Sign strength, Fits; the "agreement" sub-line is dropped (it is
1.00 for every non-weak edge); names show with codes on hover. Its
introduction explains sign strength next to the column it describes, which
had read as a claim about causal scores when that column sat off-screen.
Changed files: `index.html`, `js/app.js`, `smoke_test.js`, `CHANGELOG.md`.

## v29 — 2026-10-06 · matrix axes show names
The adjacency matrix's row and column headers show display names instead of
variable codes. Names longer than 32 characters are shortened with an
ellipsis on the axis (12 of 59 on century, 13 of 81 on modern); hovering any
header shows the full name and the code, as before. Header font switched to
the sans face for readability; column header height raised to fit. Changed
files: `index.html`, `js/app.js`, `css/style.css`, `smoke_test.js`,
`CHANGELOG.md`.

## v28 — 2026-10-06 · cache-busting asset URLs
`index.html` now references `js/app.js`, `js/assistant.js` and
`css/style.css` with `?v=<BUILD>`. Each build is therefore a new URL that
no browser or CDN cache has seen, ending the "uploaded but still showing the
old version" problem for these files. The suite fails if the query strings
and BUILD disagree. The process from here: a package's `index.html` always
goes up with its `app.js`. Changed files: `index.html`, `js/app.js`,
`smoke_test.js`, `CHANGELOG.md`.

## v27 — 2026-10-06 · notice removed
The "This site has been rebuilt" banner is removed entirely (markup, styles,
behaviour, tests). The Methods page still carries the rebuild paragraph.
The what-if selector's alphabetical order is now asserted by the suite as
well as the forecasts selector's. Changed files: `index.html`, `js/app.js`,
`css/style.css`, `smoke_test.js`, `CHANGELOG.md`.

## v26 — 2026-10-06 · alphabetical variable selectors
The Forecasts and What-if variable selectors are sorted alphabetically by
display name (case-insensitive) instead of following the matrix's export
order, which made variables hard to find in a list of 59 or 81. The matrix,
and the edge selector (already sorted by name), are unchanged. Status
suffixes ("(not forecast)", "(structural: not moved)", "(not enough observed
moves)") stay attached. Dates removed from the notice, the footer stamp and
the Methods heading (v25 repackage). Changed files: `js/app.js`,
`smoke_test.js`, `index.html`, `CHANGELOG.md`.

## v25 — 2026-10-05 · October 2026 rebuild (v3 release)
One whole replacement: nothing on the portal now includes an aggregate
democracy index; the causal structure is re-estimated with signed edges and
an exported ordering; forecasts come from one spatio-temporal graph neural
network and are shown beside what happened; the dynamics view is replaced by
what-if responses; earlier forecasts, risk maps and impulse responses are
withdrawn. Built in four stages, released as one.

**Deployment.** The repo's old `data/century_factors/` and
`data/modern_factors/` directories (including `cfact/`, `hzfan/`) are
discontinued: delete them. New layout: `data/struct/`, `data/fcst/`,
`data/dyn/`, `data/labels/`, `data/digest/`, `data/methods.json`,
`data/glossary.json`, `data/country_index_*.json`. Upload the package, then
drag `fcst/{panel}/` country files and `dyn/{panel}/cfact/` from Drive.
**Re-paste `tier3/worker.js` into Cloudflare**: the system prompt, digest
path and a methods context block all changed.

**Stage 1 — Structure, Edges, Effect curves.** `app.js` rebuilt from the
carried-over machinery. Matrix rows follow `row_order` (structural band
last), columns follow `column_order` (structural variables are rows only;
modern 81 → 65 columns); cells blue/red by sign, shaded by score, weak-sign
muted; group lines per axis; the export's own caption with the like-for-like
modularity pair. Neighbourhood network with sign-coloured arrowheads,
majority edges dashed. Edges table with sign, sign strength, agreement and a
sign filter. Effect curves on clean-elections terciles in a neutral palette,
with the additive-reading note. Every node labelled: 51 codebook, 8/16
constructs (F16 = Child mortality), 14 source names.

**Stage 2 — Forecasts (new).** Country (via `country_index`), variable and
horizon selectors; forecasts made along the way over observed history with
hollow points where the outcome is not yet observed and the in-band count
computed from the file; the forecast from the last observed year with
middle-half and 90% bands and the not-validated region; large-move
probabilities with the fall/rise caveat; "Not forecast: structural"; an
accuracy block leading with MAE beside no change and never showing MAPE.

**Stage 3 — What-if (replaces Dynamics).** Opens on one country; rise and
fall by ±0.5 SD; own-path chart with the evidence count; ranked signed
responses with a ±0.05 SD reference and a count of how many exceed it;
aggregate scope with 10th–90th percentile whiskers; explicit states for
structural variables and for directions with too few observed moves; the
file's definition visible; responses described as prediction, not cause,
and as not confirming the edge signs. NFD-named files (Türkiye) load.

**Stage 4 — Methods, glossary, assistant, notice.** Methods is rendered from
`data/methods.json`, adapted from the lab's write-up (no methods, numbers or
claims added), with the evaluation table drawn from `accuracy.json` and the
references shown as provisional until confirmed. The glossary is rewritten
for the v3 objects (23 terms; the nine entries on withdrawn objects are
gone). The assistant digest is regenerated for the v3 layout with new
framing rules; the Worker now also sends the methods text, so the Methods
page and the assistant read one source. Behavior tests rewritten. Notice
updated to the rebuild wording. README updated.

Tests: 156 checks across both panels, with temporary fixtures for the
Forecasts and What-if views and lints that fail if any withdrawn object
(polyarchy, aggregation-adjacent, λ/ρ/IRF code, old forecast or validation
files) reappears in code, glossary or digests.

Changed vs v24: everything under `data/`, `js/app.js`, `index.html`,
`css/style.css`, `tier3/worker.js`, `tier3/SYSTEM_PROMPT.md`,
`tier3/make_digests.py`, `tier3/behavior_tests.md`, `smoke_test.js`,
`README.md`, `portal_labels.csv`. `test_history.js` removed.

## v24 — 2026-10-03 · factor construct names
The lab supplied construct names for the theoretical factors (8 century,
16 modern), replacing the member-list fallback. Applied to 23 of 24; one typo
corrected ("Polulation growth" → "Population growth").

**Held: modern F16.** The name supplied was "Population density (factor)" but
the factor's members are infant mortality and under-5 mortality (WPP). Held
at the member list pending confirmation rather than displaying a name that
does not match its indicators.

Copy in Methods and the glossary that said construct names were pending now
says they are shown. The test that forbade any F-id in the overlay (correct
for pass 1) is replaced by one that forbids any v1 interpretive name from
resurfacing and requires every construct name to carry the "(factor)" mark.
Digests regenerated.

**Minimal upload for this build** — the large data directories are untouched,
so only these files change: `js/app.js`, `data/glossary.json`,
`data/{panel}/labels.json`, `data/{panel}/digest.json`, `portal_labels.csv`,
`smoke_test.js`, `CHANGELOG.md`.

## v23 — 2026-10-03 · all V-Dem node names verified against Codebook v15
Every V-Dem indicator and index on both panels (52 ids) now displays its name
from the V-Dem Codebook v15 table of contents, fetched from v-dem.net and
transcribed into `tier3/codebook_names_v15.json`. No raw V-Dem code remains
on display. The 24 singletons new in v2 are named, and the full existing set
was re-checked against the same source rather than trusted.

Two v1 names marked as verified were wrong and are corrected:
`v2stfisccap` "State fiscal capacity" → **State fiscal source of revenue**;
`v2xel_regelec` "Regional elections index" → **Regional government index**.
Six long index titles are displayed verbatim (e.g. "Freedom of expression and
alternative sources of information index"); a handful of abbreviated
codebook titles are expanded for readers ("HOS age" → "Age of head of
state"), with the codebook wording retained in the record.

Still pending: the 8 and 16 theoretical factor construct names (pass 3).
Digests regenerated with the new labels. `portal_labels.csv` records the
source and verification date for every row.

## v22 — 2026-10-03 · v2 results release, pass 1 (data swap + notice)
Data bundles swapped to the v2 export: the pipeline was rerun under a
confirmatory theoretical measurement model (A-CMB century, A-CMB-DU modern).
Every number on the portal changes. Later passes add hazard views (2), the
Methods rewrite with construct names and citations (3), and the glossary and
assistant update (4).

**Deployment workflow change.** `cfact/` and `hzfan/` (~165 MB) no longer
travel in this package. Upload them into `data/{panel}/` directly from Drive
(`Democratization/v2_theoretical/outputs/portal_export/`). Everything else
in `data/` ships here as before. The package is the build for code and small
data; the two large directories are the documented exception.

Verified before packaging (both panels): node counts 60/82 and factor counts
8/16 match the handoff and manifests; edge counts 745/509/5 and 1600/1280/1
agree with `edges.json`; every edge endpoint and ICE key resolves; no edge
targets a structural node; `forecast` flags match `role` (modern: 16
structural, up from 8); forecast keys equal the endogenous set; history covers
every node and every forecast country; all 82 modern nodes are shockable;
the five hazard files parse and are referenced by no code.

- **Corrected-results notice**: dated, dismissible banner at the top of every
  page; returns in a fresh session (sessionStorage).
- **Factor names suppressed**: v1 interpretive names are wrong for v2
  constructs and are removed from `labels.json` for every F-id. Factor nodes
  show their bundle label (the member list) until pass 3. The 48 verified
  V-Dem singleton and composite names are preserved; 30 (century) and 26
  (modern) newly added singletons show raw ids until the labels refresh.
- **Methods, Stage 2 only**: the exploratory-factor-analysis prose was wrong
  in its own terms for v2, not merely stale, and is replaced by the October
  2026 revision paragraph plus the manifest's measurement provenance string.
  The full rewrite and method citations (including Bussmann's NAVAR) wait
  for the pipeline session's write-up. The node-naming card no longer calls
  factor labels interpretive.
- **Glossary**: three v1-specific references generalized (modern ρ 0.9993,
  "29 to 47 variables", the EFA description in the factor entry). The pass-4
  rewrite is unchanged in scope.
- **Assistant digests regenerated** and scoped for v2 size: consensus edges
  only, and effect curves into the outcome node only (16 and 28 of 509 and
  1280); the digest states what it omits and points to the views. Modern
  digest 110 KB, down from a 378 KB first regeneration. The framing rule that
  named v1 factors is rewritten. **No Worker re-paste needed** — digests are
  fetched live.
- **Staleness guard**: a `cfact/` file whose node or shock set does not match
  the current bundle is refused with an explanation instead of being drawn
  against the v2 aggregate. Added because the sample `cfact` files supplied
  with this pass were v1 (29 and 47 nodes); see the open item below. A v1
  file is kept as `tier3/fixtures/stale_cfact.json` to test the guard.
- Near-permanent IRF framing is now asserted from each panel's ρ rather than
  by panel name: modern's constrained max is 0.9944 (above the 0.99 rule),
  century's 0.9899 (below).
- Tests made manifest-driven where they hard-coded `F05` or v1 counts.
- Network density worst case grew: modern `v2xel_frefair` has 52 neighbours
  and 700 edges among them (min node gap 22 px, from 68 px in v1). Hover
  isolation still reduces it to the hovered node's edges; a score-threshold
  control is the natural next step if the default view is judged too busy.

**Resolved**: the first `cfact/` samples were from the old folder. Corrected
v2 samples (6 century, 5 modern) verified: 60 and 82 baseline nodes matching
the panel node sets, shock sets matching the aggregates, every country in
`forecasts.json`, and shocked − baseline reproducing the invariant aggregate
response to 1e-05 across 487,400 values. The staleness guard stays silent on
them and fires on the v1 fixture. Safe to upload `cfact/` from Drive.

`portal_labels.csv` regenerated from the v2 bundles (142 rows, from 76):
statuses CODEBOOK (verified name shown), KEEP (bundle label already
readable), FACTOR_PENDING (construct name due in pass 3), RAW_PENDING (new v2
singleton, raw code until the labels refresh). Eight verified codebook names
that existed on only one panel in v1 are propagated to the other panel where
the same variable now appears (century +6, modern +2) — same V-Dem variable,
same name, no new verification needed. 24 singletons remain RAW_PENDING;
most are V-Dem component indices (v2x_*, v2xel_*, v2xeg_*) whose codebook
names are straightforward to verify in pass 3.

Also fixed in the test harness: its fetch shim did not decode percent-encoded
paths, so any country with a space in its name (e.g. `Costa Rica.json`)
404ed under test while working in browsers and on Pages. Both test files now
decode, matching real resolution.

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
