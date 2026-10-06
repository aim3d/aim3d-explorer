"""AIM-3D Tier-3: per-panel results digests for the portal assistant, v3 layout.

Reads data/struct/{panel}/, data/fcst/{panel}/{manifest,accuracy}.json and
data/dyn/{panel}/irf_aggregate.json, and writes data/digest/{panel}.json.
Everything in a digest is read or subsampled from the export files; no new
statistics are computed. Run after any export or label change.
"""
import json, os, re

BASE = os.environ.get("DIGEST_BASE", "data")
PANELS = {
    "century": {"name": "Century view", "span": "1900-2023"},
    "modern":  {"name": "Modern view",  "span": "1970-2021"},
}

FRAMING_RULES = [
    "No result on this portal includes an aggregate democracy index. Every result is for a component of democracy or a related condition. If asked about 'democracy' as a single score, say the index is not modeled and point to its components.",
    "An edge is causal in Granger's sense: the source's recent past improves the prediction of the receiver's next value given everything else. It is not a claim about what an intervention would do.",
    "Edge direction comes from the effect curve, by majority across three fits. Edges whose curve reverses direction across the source's range are sign-changing (form code SC, direction 0): describe them as changing direction, never as positive or negative. Every edge also has a shape code (L linear, ST saturating, T threshold, N nonlinear, SC sign-changing, M mixed); quote the shape with its agreement across the three fits, and never guess a shape for an edge not in the digest.",
    "The matrix ordering is an aid to reading: groups are not statistically distinct clusters. Quote modularity only as the chance_comparison pair (observed vs rewired_mean).",
    "Effect curves are evaluated in terciles of the clean elections index, and because NAVAR is additive the three curves of an edge share one shape and differ by a constant: do not describe them as different effects in different regimes.",
    "Forecasts come from one spatio-temporal graph neural network. Horizons are 1, 3, 5 and 10 years; the ten-year horizon is published without validation and must be labelled so.",
    "The 90% band is nominal: in the evaluation period it held the outcome 80 to 87% of the time at 1, 3 and 5 years. Never call it calibrated.",
    "Accuracy is read beside a no-change forecast. MAE is the headline measure; never lead with MAPE. These variables change slowly, so any forecast scores well; the forecast's margin over no change is small and narrows with horizon, and for some variables the point forecast is behind no change.",
    "Structural (source-only) variables are not forecast and are not moved in the what-if view. Say 'not forecast: structural', never that they were forecast as flat.",
    "A what-if response is the change in a forecast when one variable is different today. It is a statement about prediction, not an estimate of a causal effect, and it does not confirm or test the edge signs in the Structure view. A variable missing from the what-if set has 'not enough observed moves of this size', not a zero response.",
    "Per-country forecasts and per-country what-if responses are not in this digest; direct users to the Forecasts and What-if views for any country-specific figure.",
    "Factor numbering is panel-specific. Factors are theoretical constructs; use their display names and, if asked what one measures, its member indicators.",
]

def rnd(x, d=4):
    if isinstance(x, list): return [rnd(v, d) for v in x]
    if isinstance(x, float): return round(x, d)
    return x

def build(panel):
    sd = os.path.join(BASE, "struct", panel)
    L = lambda p: json.load(open(p))
    man = L(f"{sd}/manifest.json"); nodes = L(f"{sd}/nodes.json")
    ef = L(f"{sd}/edges.json"); edges = ef["edges"] if isinstance(ef, dict) else ef
    order = L(f"{sd}/matrix_order.json")
    labels_p = os.path.join(BASE, "labels", f"{panel}.json")
    labels = L(labels_p) if os.path.exists(labels_p) else {}
    fman = L(os.path.join(BASE, "fcst", panel, "manifest.json"))
    acc = L(os.path.join(BASE, "fcst", panel, "accuracy.json"))
    agg_p = os.path.join(BASE, "dyn", panel, "irf_aggregate.json")
    agg = L(agg_p) if os.path.exists(agg_p) else None

    node_out = {}
    for n in nodes:
        node_out[n["id"]] = {
            "label": labels.get(n["id"], n["label"]),
            "kind": n["kind"], "role": n["role"],
            **({"members": n["members"]} if n.get("members") else {}),
            **({"forecast": False} if n.get("forecast") is False else {}),
        }

    # Consensus edges only (the canonical graph), compact positional rows.
    edge_out = [[e["source"], e["target"],
                 0 if e.get("form") == "sign-changing" else (1 if e["sign"] > 0 else -1),
                 rnd(e["score_median"], 5), rnd(e["sign_strength"], 2),
                 e.get("form_code", ""), e.get("form_agreement", ""), e["retention"]]
                for e in edges if e["consensus"]]

    blocks = [{"name": b.get("name", f"Block {b['id']}"), "nodes": b["nodes"]} for b in order.get("blocks", [])]

    acc_overall = [{k: rnd(v) for k, v in r.items()} for r in acc["overall"]]
    acc_nodes = {}
    for nid, rec in acc["nodes"].items():
        acc_nodes[nid] = {h: {"n": v.get("n"), "mae": rnd(v.get("mae")), "mae_persistence": rnd(v.get("mae_persistence")),
                              "error_pct_of_range": rnd(v.get("error_pct_of_range")),
                              "error_pct_of_range_persistence": rnd(v.get("error_pct_of_range_persistence"))}
                         for h, v in rec["by_h"].items()}

    whatif = None
    if agg:
        whatif = {
            "definition": agg.get("definition"), "n_countries": agg.get("n_countries"),
            "state_year": agg.get("state_year"), "min_support": agg.get("min_support"),
            "horizons": agg.get("horizons"), "validated_horizons": agg.get("validated_horizons"),
            "not_shocked": agg.get("not_shocked", []),
            "not_supported": {k: v for k, v in (agg.get("not_supported") or {}).items()},
            "observed_moves": agg.get("observed_moves", {}),
            # Mean own-response (how much of the move remains) per shocked node, both directions.
            "own_response_mean": {
                "rise": {k: rnd(v.get(k)) for k, v in agg["shocks"].items() if k in v},
                "fall": {k: rnd(v.get(k)) for k, v in agg["shocks_fall"].items() if k in v},
            },
            "note": "Cross-node responses are small (few exceed 0.05 SD) and vary several-fold across countries; per-node and per-country responses are in the What-if view.",
        }

    return {
        "panel": panel, "panel_name": PANELS[panel]["name"], "panel_span": PANELS[panel]["span"],
        "generated_from": man.get("generated") or man.get("built"),
        "provenance": {k: v for k, v in (man.get("provenance") or {}).items() if isinstance(v, str)},
        "counts": {"n_nodes": man["n_nodes"], "n_edges_majority": man["n_edges_majority"],
                   "n_edges_consensus": man["n_edges_consensus"], "n_edges_positive": man.get("n_edges_positive"),
                   "n_edges_negative": man.get("n_edges_negative"), "n_edges_weak_sign": man.get("n_edges_weak_sign"),
                   "n_edges_by_form": man.get("n_edges_by_form"),
                   "n_countries": man["panel_meta"]["n_countries"], "years": man["panel_meta"]["years"]},
        "framing_rules": FRAMING_RULES,
        "edges_schema": "[source, target, direction(+1 rise / -1 fall / 0 sign-changing), score_median, sign_strength, form_code, form_agreement, retention]; consensus edges only",
        "form_legend": ef.get("form_legend"),
        "form_rule": ef.get("form_rule"),
        "nodes": node_out,
        "edges": edge_out,
        "matrix_order": {"caption": order.get("caption"), "meaning": order.get("meaning"),
                         "chance_comparison": order.get("chance_comparison"), "blocks": blocks},
        "forecasts": {
            "model": fman.get("model"), "horizons": fman.get("horizons"), "validated_horizons": fman.get("validated_horizons"),
            "last_observed_year": fman.get("last_observed_year"), "n_countries": fman.get("n_countries"),
            "evaluation_origins": fman.get("evaluation_origins"), "definitions": fman.get("definitions"),
            "not_forecast": fman.get("not_forecast"),
            "band_coverage_note": "nominal 90% band; realized coverage 80-87% at 1, 3 and 5 years in the evaluation period",
        },
        "accuracy": {"headline_measure": acc.get("headline_measure"), "definitions": acc.get("definitions"),
                     "overall": acc_overall, "nodes": acc_nodes,
                     "min_forecasts_per_country_figure": acc.get("min_forecasts_per_country_figure")},
        "whatif": whatif,
        "not_in_digest": "Per-country forecasts, per-country what-if responses, effect-curve values, and majority-only edges are not included; they are in the Forecasts, What-if, Effect curves and Edges views.",
    }

if __name__ == "__main__":
    os.makedirs(os.path.join(BASE, "digest"), exist_ok=True)
    for panel in PANELS:
        d = build(panel)
        out = os.path.join(BASE, "digest", f"{panel}.json")
        with open(out, "w") as f:
            json.dump(d, f, separators=(",", ":"), ensure_ascii=False)
        print(f"{panel}: {os.path.getsize(out)/1024:.1f} KB ({len(d['edges'])} consensus edges, {len(d['nodes'])} nodes)")
