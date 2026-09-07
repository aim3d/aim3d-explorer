# Portal export request — selectable-shock impulse responses

Handoff from the portal build session (portal build v20).

## What users are asking for

The Dynamics tab currently shows impulse responses to a single shock variable
per panel: `F05` (century) and `F06` (modern), fixed at export time. Readers
want to choose **which variable is shocked** and **whether they are looking at
the panel aggregate or a specific country**.

So: an IRF surface over (shock variable) × (responding node) × (horizon), for
the aggregate and per country.

## Current export, for reference

`dcnar.json → irf` carries:

```json
{ "shock_var": "F06", "horizons": [1..10], "response": { "<node>": [h1..h10] } }
```

with `meta.shock_var`, `meta.shock_size_sd` (1.0), `meta.H_irf` (10), and
`meta.irf_countries` — which on the modern panel is
`["Sweden [1996-2021]", "Panama", "Saudi Arabia"]`. Nothing in the export says
what that list means for the displayed numbers (see question 1 below), and no
`provenance` string covers the IRF at all.

## Requested schema

Two artefacts per panel. Both are additive; nothing already exported changes.

### 1. Aggregate — `irf_aggregate.json`

```json
{
  "panel": "modern_factors",
  "scope": "aggregate",
  "definition": "<one line: exactly what the aggregate averages over>",
  "shock_size_sd": 1.0,
  "horizons": [1, 2, "...", 10],
  "units": "standardized",
  "shocks": {
    "F06": { "v2x_polyarchy": [h1, "...", h10], "F01": ["..."] },
    "F01": { "...": ["..."] }
  }
}
```

Sizes, computed from the current bundles: century 29 shocks × 29 responses ×
10 horizons = 8,410 values, about 57 KB. Modern 47 × 39 × 10 = 18,330 values,
about 125 KB. Both are small enough to ship in the main bundle and load
eagerly.

### 2. Per country — `irf/<country>.json`, one file per country

Same inner shape as `shocks` above, plus a `country` field and the
`segment_key` used elsewhere. **One file per country, not one file for all
countries**: the portal loads a country's file only when the user selects it,
so browsing shocks within a country is instant while the initial page load
stays unaffected.

Per-file size is the same as the aggregate (57 KB century, 125 KB modern).
Totals across countries would be roughly 9.0 MB (century, 160 countries) and
16.9 MB (modern, 138). That is fine for GitHub Pages as long as it is split
per country; a single combined file would not be.

Country keys must match the keys already used in `forecasts.json` and
`history.json`, so the portal's existing country selector can drive it.

## Questions that need your answer, not our guess

1. **What does the current IRF represent?** `meta.irf_countries` lists three
   countries. Are the exported responses evaluated at one of them, averaged
   across them, or something else? Whatever the answer, please carry it into
   the new export's `definition` field and add an `irf` entry to
   `manifest.provenance` so the portal can display it verbatim.

2. **What should "aggregate" mean?** Mean across all countries, a
   representative τ, or the system evaluated at the panel mean? We will label
   it with whatever you choose; we should not be picking it.

3. **Which variables can be shocked?** Our assumption: any node, including the
   8 structural (source-only) nodes on the modern panel, since those have
   outgoing edges and shocking them is meaningful even though nothing is
   estimated onto them. Confirm or correct.

4. **Which variables respond?** Our assumption: endogenous nodes only —
   structural nodes are never targets, so they cannot respond. That gives the
   47 × 39 shape above for modern. Confirm.

5. **Is a per-country IRF well defined** given that the tvNAR coefficients
   vary with τ (within-series time) rather than with country? If a country's
   IRF is really "the system at that country's τ range", say so in
   `definition`; if per-country responses are not defensible, tell us and we
   will ship the aggregate alone rather than present something that implies
   more country-specificity than the model supports.

6. **Does the shocked variable's own response belong in the matrix?** We would
   like it included (its own decay path is informative), but only if that is
   what the model produces.

## Non-goals

- No change to `dcnar.json`'s existing `irf` block; leave it in place so the
  current portal build keeps working until the new files land.
- No re-estimation, and no new statistics beyond the IRF surface.
- Nothing needed for the spectral radius: ρ(τ) is a property of the whole
  system, one series per panel, and the portal was wrong to imply otherwise
  in its layout. That is fixed portal-side, no export change required.

## What the portal will do with it

Dynamics gains two controls above the IRF: a shock-variable selector and a
scope selector (Aggregate, or a specific country). The heatmap re-renders on
change. The `definition` string and the provenance entry will be displayed
alongside, so a reader always knows whether they are looking at an average or
a single country, and evaluated how.

Until these files exist, the portal shows the single exported shock and now
states plainly that responses to other shocks are not part of the export.
