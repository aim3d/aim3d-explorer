# Review of v25 stage 1, and changes to the structure export

From the pipeline session, 5 October 2026. For the portal session.

## What was checked

The build's own test suite was run, and every view on both panels was opened in a headless browser.

| Check | Result |
|---|---|
| The build's tests | All pass |
| Page errors, all views, both panels | None |
| Democracy index absent from nodes, matrix, edges, effect curves | Yes |
| Matrix direction, 60 one-way consensus edges on century | All 60 drawn at source row, receiver column; none mirrored |
| Colors against signs | Blue positive, red negative, weak-sign muted |
| Rows and columns follow the exported order | Yes |
| Edge counts | 803 / 550 century, 1,518 / 1,200 modern |
| Effect-curve legend and note | Clean elections terciles; additive note present |

The structure is sound. The items below are about presentation and text.

## Changes to the export (rerun of `Pipeline_V3_S7_StructureExport`)

The `struct/` folders will be regenerated. Edges, effect curves and history do not change. These do:

### `matrix_order.json`

| Field | Change |
|---|---|
| `order`, `row_order` | The structural band now comes LAST, not first. Dynamic blocks start at the top-left |
| `column_order` | New. The same order without the structural nodes. Use it for columns: nothing is estimated into a structural node, so those columns were empty and filled the left half of the modern matrix |
| `chance_comparison` | New. `observed`, `rewired_mean`, `rewired_sd`: the like-for-like pair. Quote these together |
| `caption` | New. A ready caption with the like-for-like numbers |
| `meaning` | Reworded: an ordering, not cohesive groups |
| `blocks` | Same content; the structural block (id 0) is now the last entry |

`nodes.json`: `matrix_position` follows the new order.

**Correction needed on the portal.** The caption and the Methods panel pair `modularity` (the stabilized grouping) with `modularity_rewired_mean` (single runs). That is not like for like. Use `chance_comparison.observed` against `chance_comparison.rewired_mean`, or print `caption` as it stands. The figures from the last run were 0.215 against 0.238 on century and 0.193 against 0.180 on modern; read the current ones from the file.

### `manifest.json`

Every entry under `provenance` is now a plain sentence written for readers: `measurement`, `index`, `edge_selection`, `edge_sign`, `matrix_order`, `effect_curves`, `forecasts`, `dynamics`. They can be shown as they are.

The machine-readable effect-curve record has moved out of `provenance` to a new top-level key, `records`. It is for developers. Do not print it.

The internal note on the measurement model (initials, a memo file name, "handoff decision 2") is no longer in the export. It was showing on the Methods page.

## Still on the portal side

1. **Methods page.** Stop printing export records verbatim. After this rerun the `provenance` strings are safe to show; the raw JSON block and anything under `records` are not.
2. **Like-for-like modularity,** as above, in the matrix caption and the Methods panel.
3. **Matrix columns.** Use `column_order`. A structural variable then appears as a row only.
4. **Column headings are clipped** at the top for long variable codes, for example the freedom of expression and freedom of association indices.
5. **Effect-curve colors.** The low group is red and the high group blue. Elsewhere those colors mean negative and positive. A neutral set for the three groups would avoid that reading.
6. **Reader's guide.** It still describes withdrawn items: the democracy index, lambda paths, impulse responses, the spectral radius, DCNAR. Already planned for stage 4.
7. **README** still gives the current build as v22.

**Not an issue.** The matrix is wider than its frame (1,630 pixels on century, 2,267 on modern, in a frame of 1,036) and scrolls sideways. Professor Kuskova has said this is acceptable. Using `column_order` narrows the modern matrix by 16 columns.

## Tests worth adding

- Columns equal `column_order`; no structural node appears as a column.
- The caption's two modularity figures equal `chance_comparison.observed` and `chance_comparison.rewired_mean`.
- The Methods page contains no `{`, no file name ending in `.docx`, and no variable code where a name is expected.
