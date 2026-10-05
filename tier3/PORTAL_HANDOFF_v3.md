# Portal handoff: the v3 release

From the pipeline session, 5 October 2026. For the session that maintains the AIM-3D Explorer. This note replaces `portal_handoff_v3_forecast.md`.

The v3 release replaces everything the portal shows. It is one whole replacement, with one notice to visitors. The portal reads committed files only and computes no statistics.

## 1. What changed, in one table

| View | Before (v2) | Now (v3) |
|---|---|---|
| All views | The aggregate democracy index was a node | The index is gone: not a node, not a target, not derived anywhere |
| Structure, Edges | Unsigned edges, fixed node order | Every edge has a sign; the matrix is ordered into cohesive blocks; NAVAR refitted without the index |
| Effect curves | Regimes = terciles of the democracy index | Regimes = terciles of the clean elections index |
| Dynamics, counterfactuals | tvNAR impulse responses (edges were reversed in that calculation) | What-if responses from the forecaster |
| Forecasts | Hazard models; index forecast | One neural forecaster; no index forecast; 10-year horizon added |
| Forecast accuracy | Not shown | MAE against actual outcomes, beside a no-change forecast |

Discontinued, and not to be shown: any forecast, fan, trajectory or edge involving the democracy index; hazard risk maps and the hazard leaderboard; tvNAR lambda paths, spectral-radius panels and the old impulse responses; the NAVAR rollout forecast and its validation table.

## 2. Where the files are

Drive: `Democratization/v3_forecasting/outputs/portal_export_v3/`

| Folder | Written by | Files |
|---|---|---|
| `struct/{century,modern}/` | `Pipeline_V3_S7_StructureExport` | `nodes.json`, `edges.json`, `matrix_order.json`, `ice.json`, `history.json`, `manifest.json` |
| `fcst/{century,modern}/` | `Pipeline_V3_T6`, `T8` | `{country_id}.json` (167 / 148 files), `manifest.json`, `accuracy.json` |
| `dyn/{century,modern}/` | `Pipeline_V3_T7_WhatIf` | `cfact/{country name}.json` (152 / 135 files), `irf_aggregate.json`, `manifest_dyn.json` |

Sizes: the `dyn` country files total about 105 MB (century) and 99 MB (modern). Upload those folders directly from Drive, as was done for `cfact/` before.

## 3. Structure and Edges

`nodes.json` and `edges.json` keep their layout. What is new in `edges.json`, per edge:

| Field | Meaning |
|---|---|
| `sign` | +1 or -1 |
| `signed_score` | `sign` times `score_median` |
| `sign_agreement` | Share of seeds agreeing on the sign |
| `sign_strength` | How clear the sign is, 0 to 1 |
| `weak_sign` | True when `sign_strength` is below 0.60 |

The `aggregation_adjacent` field is gone.

**Display [decided by Professor Kuskova].** Blue for positive, red for negative, shade by `score_median`. Draw `weak_sign` edges in a muted or neutral shade: for those the effect rises over part of the source's range and falls over another, so a firm color would overstate them. A one-line caption should say that the effect curve is the full picture.

**Layout.** Matrices keep NAVAR's convention: the source is the row, the receiver is the column. Do not transpose.

**Matrix order [decided by Professor Kuskova].** `matrix_order.json` groups the score matrix into cohesive blocks: variables that are strongly linked to each other sit together, so strong values gather in squares on the diagonal.

| Field | Use |
|---|---|
| `row_order` (same as `order`) | Sort rows by this list. Structural sources form the last band |
| `column_order` | Sort columns by this list: the same order without the structural nodes, which receive nothing and would be empty columns |
| `caption` | Ready caption, with the like-for-like comparison with chance |
| `chance_comparison` | `observed` and `rewired_mean`: the pair to quote together. Do not pair `modularity` (the stabilized grouping) with the rewired figure |
| `blocks` | Draw a line at each block boundary. Each block has an `id`, a `name` and its `nodes`. On modern the last block is the structural band (sources only) |
| `block_matrix` | For each source block and target block: `density`, `mean_score`, `share_positive`. Can be shown as a small summary beside the matrix |
| `membership[node]` | `block`, `strength` (0 to 1: how often the node sits with its block-mates across 100 runs), `borderline` (true below 0.60), `next_block` |
| `modularity`, `modularity_rewired_mean`, `modularity_z`, `stability_ari`, `share_of_strength_within_blocks` | Quality of the grouping against chance, for the Methods text |

`nodes.json` carries the same `block` and `matrix_position` for each node, with `block_strength` and `block_borderline`. The blocks are numbered, not named: naming them is for the authors.

**How to present it.** The grouping does not exceed what a randomly rewired graph of the same density gives: on century the modularity is 0.215 against 0.238 in rewired graphs, and on modern 0.193 against 0.180, about two standard deviations in opposite directions. So:

- Use `row_order` and `column_order` to sort the matrix. It places strongly linked variables next to each other and makes the picture easier to read.
- Describe it as an ordering, not as communities. Suggested caption: "Variables are ordered so that strongly linked ones sit together. The groupings are an aid to reading and are not statistically distinct clusters."
- Block lines, if drawn at all, should be faint. Do not name the blocks on the portal unless Professor Kuskova supplies names.
- Borderline variables (`membership[node].borderline`) need no special mark under this presentation. The portal computes nothing here; it applies the order it is given. Keep the sign coloring on top of the new order.

Counts, from the pipeline logs: century 59 nodes, 803 edges kept in at least two of three seeds (550 in all three), 71% positive. Modern 81 nodes, of which 16 are structural, 1,518 edges (1,200 in all three), 56% positive. The number of weak-sign edges is in each `manifest.json`.

**Labels.** The exports are keyed by node ID and carry the long indicator-list labels. Keep applying the display names from `portal_labels.csv`. Three corrections to that file before release: F16 on modern is labeled "Population density" but its indicators are infant and under-5 mortality; F11 on modern reads "Polulation growth"; and the two rows for the democracy index should be removed. F12 on modern ("Cultural globalization", built from informational and interpersonal globalization) is worth a second look. The 24 factor names are marked pending; update the status once Professor Kuskova confirms them.

**A caution for the Methods text.** Several of the strongest modern edges are close to accounting relationships within the demographic block (life expectancy into mortality; population growth into urban and rural growth). They are real predictive relationships and should not be presented as findings.

## 4. Effect curves

`ice.json` keeps its layout: one entry per edge, three curves keyed `low`, `mid`, `high`. Edges covered: 550 (century), 1,200 (modern), the ones kept in all three seeds.

The regimes are now terciles of the clean elections index (`v2xel_frefair`). The legend must say "clean elections", not "democracy". A sentence for readers is in `manifest.json` under `provenance.effect_curves`; the cut points are under `records.effect_curves`, which is for developers and not for display. Every entry under `provenance` is plain text that can be shown as it is.

Reading note for the caption: NAVAR is additive, so the three curves of an edge have the same shape and differ by a constant. The split shows where each regime's typical values sit, not different effects in different regimes.

## 5. Forecasts

**Correction (5 October).** An earlier version of this note said the existing fan view should load these files. There is no fan view on the portal: the Forecasts view is a new build. The schema is described in `fcst/{panel}/manifest.json` under `definitions`, and every file carries its own row-format keys.

Country files in `fcst/` hold `name`, `country_id`, `gate`, `scope`, `row_format`, `fans`, `observed`, and: `horizons`, `validated_horizons`, `last_observed_year`, `fans_full` (with quartiles), `forecast` (issued from the last observed year), `large_move`, `large_move_forecast`, `large_move_threshold`, `source`.

Two things to build for:

1. `fans` includes recent forecasts whose outcome is not yet observed. Do not assume every row has an observed value at `year + h`.
2. There are four horizons: `"1"`, `"3"`, `"5"`, `"10"`. Label `"10"` "not validated" wherever it appears.

Display rules:

- **Actual against forecast.** Draw `observed` with the forecasts from `fans` over it. This is the main purpose of the view.
- **Going forward.** Draw `forecast` from the last observed year: 2023 on century, 2021 on modern. On modern the 1 and 3-year targets are already past; show them as issued.
- **Bands.** The band is a nominal 90% band. In the evaluation period it held the outcome 80 to 87% of the time at 1, 3 and 5 years. Say so; do not call it calibrated.
- **Nodes not forecast.** The 16 structural nodes on modern are listed in `manifest.json` under `not_forecast`. Show "not forecast: structural", not an empty chart.
- **Large-move probabilities.** A large move is a change of more than half a standard deviation of the node's level. Fall probabilities are informative at every validated horizon; rise probabilities at one year and weakly beyond. A caption should say so.

## 6. Forecast accuracy

`fcst/{panel}/accuracy.json`, one file per panel. **MAE is the measure of record [decided by Professor Kuskova].**

| Show | Field |
|---|---|
| MAE in the variable's own units | `mae` |
| MAE of a no-change forecast, beside it | `mae_persistence` |
| The same error as a percentage of the variable's range | `error_pct_of_range` (and `_persistence`) |

The file has three levels: `overall` (by horizon), `nodes[node].by_h[h]`, and `countries[country_id][node][h]`, a row of `[n, mae, mae_persistence, error_pct_of_range, error_pct_of_range_persistence, mape, mape_persistence]`. A country figure exists only where at least three forecasts could be scored.

**Do not lead with MAPE.** It is in the file for reference. It is defined for only 12 of 59 century nodes and 14 of 65 modern nodes, because most variables are scores centered on zero, and on that subset the forecast is slightly behind a no-change forecast.

Numbers for the Methods page, forecasts made from 2006:

| | 1 year | 3 years | 5 years | 10 years (not validated) |
|---|---|---|---|---|
| Century, error as % of range | 1.66% | 3.27% | 4.41% | 6.45% |
| Century, no-change forecast | 1.69% | 3.31% | 4.41% | 6.34% |
| Century, MAE against no change | 0.970 | 0.975 | 0.989 | 1.006 |
| Modern, error as % of range | 1.55% | 3.00% | 4.05% | 5.94% |
| Modern, no-change forecast | 1.59% | 3.06% | 4.09% | 5.94% |
| Modern, MAE against no change | 0.952 | 0.958 | 0.967 | 0.968 |

On the full forecast distribution the model is further ahead: 5 to 6% better than no change on century and 8% on modern (score ratios 0.941 / 0.941 / 0.948 and 0.922 / 0.916 / 0.919 at 1, 3, 5 years).

Wording to keep honest: these variables change slowly, so any forecast, including no change, scores well. The forecast's margin over no change is small and narrows with horizon. For some variables, led by rule of law and freedom of association, the point forecast is behind no change.

Source of every number: `final_table.csv`, `accuracy_overall.csv`, `accuracy_node.csv` under `outputs/forecast/{panel}/final/`. Quote from those files if more decimals are needed.

## 7. Dynamics and counterfactuals: what-if responses

The files in `dyn/` keep the old layout (`baseline`, `shocks` keyed by shocked node, `shocked` paths per responder), with these differences:

| | Old | New |
|---|---|---|
| Source | tvNAR linear system | The forecaster, asked again with one input changed |
| Shock | One standard deviation | Half a standard deviation of the node's level: a large move |
| Directions | One | Two: `shocks` (rise) and `shocks_fall` |
| Horizons | 1 to 10, every year | 1, 3, 5, 10 |
| Baseline | A model path | The published forecast median, with `baseline_q05` / `baseline_q95` |
| Responders | Dynamic nodes | Forecast targets |
| Per shocked node | `shocked`, `l2_norm_shocked` | plus `response` (shocked minus baseline) |

Nodes that are not shocked:

- `not_shocked`: structural nodes (they do not make large moves).
- `not_supported`: nodes for which a one-year move of that size has been observed fewer than 20 times in that direction. On century, 4 nodes lack a supported fall. On modern, 6 nodes lack a supported rise and 13 a supported fall: the slow-moving economic and demographic variables, among them the GDP per capita factor, GNI, life expectancy and the mortality factor in both directions. The exact lists are in each file.
- `observed_moves` gives, for every node, how many large rises and large falls have been observed. Show the count beside a response ("based on 22 observed cases"), so a visitor can see how much evidence stands behind it.

A node missing from `shocks` or `shocks_fall` should be shown as "not enough observed moves of this size", not as a zero response.

`irf_aggregate.json` holds the mean response across countries (`shocks`, `shocks_fall`) and the 10th and 90th percentiles across countries.

**Wording.** A response is the change in the forecast when one variable is different today. It is a statement about prediction, not an estimate of a causal effect. The definition string in each file says this; keep it visible.

**What visitors will see.** The view is quiet, and that is the finding:

- A large move is expected to persist: the forecast gives back nothing for three years and about a tenth of the move by ten years.
- Other variables barely respond. At five years 2.5% of responses on century and 0.5% on modern exceed 0.05 standard deviations; at ten years 5.6% and 1.8%.
- Countries differ a great deal: the spread across countries is three to four and a half times the mean response. Lead with the per-country view.
- Rises and falls are not mirror images (they differ by 32% on century and 22% on modern).

Do not claim that the what-if responses confirm the signs in the Structure view. They do not: the response has the edge's sign for 52 to 57% of edges, where 50% is chance.

## 8. Joining forecasts and what-if files

`fcst/` is keyed by country number and `dyn/` by country name. `country_index_{panel}.json`, beside the three folders, gives the join: for every country its `country_id`, `name`, `forecast_file` and `whatif_file`. Use `whatif_file` exactly as given; it is the name as Drive stores it, and the index records its Unicode form. A null `whatif_file` means the country was not observed in the panel's last year and has no what-if responses. `Pipeline_V3_P1_PortalBundle` writes the index and a zip with the structure folders, the manifests and sample country files.

## 8a. Three technical checks

1. **Accented country names.** The `dyn` files are named by country, and Drive can return accented names in a different Unicode form than they were written in. Check that Türkiye, Côte d'Ivoire and São Tomé and Príncipe load. If they do not, normalize the name to NFC before building the file path. The `fcst` files are named by country number and are not affected.
2. **Rows without outcomes** in `fans` (section 5).
3. **The `"10"` horizon** in every horizon selector.

None of these could be tested from the pipeline session, which cannot see the portal's code.

## 9. Method, in words the Methods page can adapt

**Structure.** A neural additive vector autoregression (NAVAR) is fitted three times to each panel. An edge is kept if removing the source's contribution reliably worsens the target's prediction (false discovery rate 5%), if it falls in the group of large effects, and if this holds in at least two of the three fits. Each edge's sign is the direction in which its contribution moves with the source.

**Forecast.** One neural network serves all countries. It reads the last 30 years (century) or 20 years (modern) of every node, passes information between countries along borders, trade and learned ties, and gives each forecast node a function of its own last three years. It starts from a no-change forecast and learns adjustments. Six trained copies are averaged. It was refitted at 2000, 2005, 2010 and 2015 using only outcomes known at each date; every reported score is for forecasts made from 2006. The structure is not an input to the forecast.

**Why NAVAR is not run forward.** Run forward against held-out years on the century panel, it was 25 to 45% worse than no change at two to five years. It is used for what it does well: one-step relationships.

Citations are still to be verified and will follow with the paper's reference list.

## 10. Draft notice for visitors

> This site was rebuilt on [date]. Nothing shown here now includes an aggregate democracy index: every result is for a component of democracy or a related condition. The causal structure was re-estimated, and each relationship is now shown with its direction of effect. The forecasts come from a new model, extend to ten years (the ten-year horizon is marked as not yet validated), and are shown beside what actually happened, with their error. The earlier dynamics view has been replaced by a "what if" view that shows how the forecast changes after a large move in one variable. Earlier forecasts, risk maps and impulse responses have been withdrawn.

## 11. Open items owned by the pipeline session

- Verified citations for the Methods page.
