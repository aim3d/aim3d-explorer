# AIM-3D: Methods

From the pipeline session, 5 October 2026. For the portal session, as the source text for the Methods page and the reader's guide.

**How to use this file.** It describes only what is in use. Adapt the wording to the portal's voice, but do not add methods, numbers or claims that are not here or in the export files. The references were written from memory and have not yet been checked against their sources; treat the list as provisional until Professor Kuskova confirms it.

---

## 1. Overview

The analysis has three parts, applied to two country-year panels.

1. **Measurement.** Indicators are combined into the constructs they measure, so that the unit of analysis is a concept and not a single indicator.
2. **Causal structure.** A neural additive vector autoregression (NAVAR) estimates which constructs influence which, in what direction, and with what shape.
3. **Forecasting.** A spatio-temporal graph neural network forecasts every construct for every country 1, 3, 5 and 10 years ahead, with uncertainty bands, the probability of a large change, and the response of the forecast to a large change in any one construct.

The two models have separate jobs. NAVAR describes relationships one year ahead. The forecasting network produces the multi-year forecasts.

## 2. Data and measurement

**Panels.** The century panel covers 169 countries from 1900 to 2023 with 103 indicators from the Varieties of Democracy dataset [Coppedge et al. 2025]. The modern panel covers 150 countries from 1970 to 2021 and adds economic, demographic and globalization measures from the World Development Indicators [World Bank 2025], World Population Prospects [United Nations 2024], the KOF Globalisation Index [Gygli et al. 2019] and the Maddison Project [Bolt and van Zanden 2024], for 141 indicators. Each uninterrupted run of years for a country is treated as one spell, and no calculation crosses a gap between spells.

The aggregate electoral democracy index is not included. It is built from components that are themselves in the panels, so democracy enters only through its components.

**Constructs.** Indicators that measure the same concept are combined by confirmatory factor analysis [Bollen 1989], and each factor is scored by its best linear unbiased predictor. Sets of categories that sum to a whole are re-expressed as log-ratios [Aitchison 1986], so that the parts can be analyzed without the dependence a fixed total creates. Indicators that stand for a concept alone enter as they are. Each resulting variable is called a node.

| | Century | Modern |
|---|---|---|
| Factors | 8 | 16 |
| Log-ratio composites | 2 | 2 |
| Single indicators | 49 | 63 |
| Nodes | 59 | 81 |

The eight century factors are civil liberties, engagement in independent associations, party institutionalization, politicized judiciary, autocratic legitimacy, academic freedom, corruption and inclusive development. The modern panel has the same eight and adds GDP per capita, economic growth, population growth, migration, child mortality, and cultural, economic and political globalization.

**Structural and dynamic nodes.** Some nodes differ between countries but barely change within them, such as land area. They are identified with the intraclass correlation [Shrout and Fleiss 1979], the share of a node's variance that lies between countries. A node with more than 90% of its variance between countries is structural: it may influence other nodes, but no relationship is estimated into it and it is not forecast. The century panel has no structural nodes. The modern panel has 16, leaving 65 dynamic nodes.

## 3. Causal structure

**The model.** The structure is estimated with Neural Additive Vector Autoregression, NAVAR [Bussmann et al. 2021]. NAVAR predicts each node's next value from the last three years of every node. Each source node passes through its own small neural network and makes a separate contribution to each target, and the prediction for a target is the sum of those contributions. A contribution can take any shape, so thresholds and saturation are allowed, while the additive form keeps each source's influence on each target separately visible. The size of an influence is summarized by a causal score, the standard deviation of the contribution across the data. The model is fitted with the last five years of every country's record held out.

An influence in this sense is causal as Granger defined it: the source's recent past improves the prediction of the target's next value, given the recent past of everything else [Granger 1969]. It is not a claim about what an intervention would do.

**Which edges are kept.** A fitted model assigns some contribution to every pair of nodes. An edge from a source to a target is kept only if it passes three tests.

1. **Forecast necessity.** The source's contribution to the target is removed, and the rise in the target's prediction error is measured [Kuskova et al. 2026a]. A one-sided Diebold-Mariano test asks whether the rise is reliable [Diebold and Mariano 1995], and the false discovery rate across all pairs is held at 5% [Benjamini and Hochberg 1995].
2. **Dominance.** Among the edges that pass, the error increases fall into a mass of small effects and a group of large ones. A two-component mixture model separates them, and the large group is kept.
3. **Replication.** The model is fitted three times from different random starting points. An edge kept in at least two fits is retained, and the edges kept in all three form the consensus graph.

**Signs.** A causal score measures the size of an influence, not its direction. Each edge receives a sign from the direction in which its contribution moves with the source's most recent value, by majority across the three fits. Where the contribution rises over part of the source's range and falls over another, the edge is marked as weakly signed.

**Effect curves.** For each consensus edge, the target's predicted value is traced as the source is moved across its observed range, with everything else held as observed. This is an individual conditional expectation curve [Goldstein et al. 2015], and it shows the shape of the relationship, which a single score or sign cannot [Kuskova et al. 2026b]. Curves are reported for three groups of country-years, the lower, middle and upper thirds of the clean elections index. Because the model is additive, the three curves of an edge share one shape and differ by a constant: the grouping shows where each group's typical values lie on the curve.

**Displaying the structure.** The structure is shown as a matrix with sources in rows and receivers in columns, colored by sign and shaded by causal score. Nodes are ordered so that strongly linked ones sit together, using modularity-based community detection [Blondel et al. 2008] made stable by consensus across repeated runs [Lancichinetti and Fortunato 2012]. The ordering is an aid to reading.

## 4. Forecasting

**What is forecast.** For every dynamic node, country and year, the forecast is how much the node will have changed 1, 3, 5 and 10 years later. A forecast is a distribution, reported as its 5th, 25th, 50th, 75th and 95th percentiles and estimated by quantile regression [Koenker and Bassett 1978]. The median is the point forecast, and the outer percentiles give a nominal 90% band.

**The model.** The forecaster is a spatio-temporal graph neural network [Yu et al. 2018; Wu et al. 2019]. One model, with one set of weights, serves all countries, so a pattern learned from one country's history is available when the model reads another's.

- **Inputs.** For each country, the level and the one-year change of every node over the previous 30 years on the century panel and 20 on the modern panel.
- **History.** Layers of the network combine each year with progressively earlier years, so that events decades back can bear on the present.
- **Ties between countries.** At each layer a country's state is updated with information from its neighbours, defined as countries whose borders lie within 100 km in that year [Weidmann et al. 2010; Schvitz et al. 2022]; from its trading partners, weighted by their share of its trade [Barbieri et al. 2009]; and from countries the model learns to associate with it.
- **Each node's own recent past.** Each forecast node also reads its own last three years through a function of its own.
- **Output.** The model starts from a no-change forecast, with a band taken from how much that node has changed over the same horizon in the past, and learns adjustments to it. The adjustments start at zero, so an untrained model reproduces the no-change forecast exactly.

The published forecast averages six independently trained copies of the model [Lakshminarayanan et al. 2017].

**Keeping the future out of the forecast.** A forecast made in a given year uses only information available that year. The model is refitted at 2000, 2005, 2010 and 2015, each time learning only from changes fully observed by that date, and each fit issues the forecasts for the years until the next. Choices about the model's size and training length are made by fitting to outcomes observed by 2000 and checking against outcomes observed in 2001 to 2005. All reported accuracy is for forecasts made in 2006 or later. The 1, 3 and 5-year horizons are validated in this way. The 10-year horizon is published without validation, because too few ten-year outcomes have yet been observed.

The forecast for future years comes from a final fit on all observed data, issued from the last year of each panel: 2023 for the century panel and 2021 for the modern panel.

**Probabilities of large changes.** Democratic change is punctuated: long periods of little movement are broken by short periods of large movement [Goertz 2003]. For each node, country and horizon, the probability of a large fall and of a large rise is therefore also estimated. A large change is one of more than half a standard deviation of the node's own level. The probabilities come from a second model with the same inputs, which divides each node's historical changes into large falls, large rises and everything else, and learns how likely each is given a country's current situation.

**What-if responses.** To show what would change a forecast, the forecaster is asked again. For each country, its latest observed data are taken, a large change is applied to one node, everything else is left as observed, and the change in the forecast median of every other node is read at each horizon. Four rules keep the exercise within what the model has learned:

- the change applied is half a standard deviation in one year, upward and separately downward;
- a node is changed only in a direction in which at least 20 such one-year changes have been observed, and structural nodes are never changed;
- one country is changed at a time, so that its response is not mixed with the same change arriving from its neighbours;
- each horizon is forecast directly, with nothing run forward step by step.

A what-if response is the change in a forecast when one condition is different today. It is a statement about prediction, not an estimate of a causal effect.

## 5. Evaluation

Every forecast made in 2006 or later is compared with the value that was then observed. The reference throughout is a no-change forecast. These nodes change slowly, so any forecast, including no change, is close to the outcome, and accuracy is meaningful only when read beside that reference.

| What is judged | Measure | How to read it |
|---|---|---|
| The point forecast | Mean absolute error (MAE) of the median, in the node's own units | Shown beside the MAE of a no-change forecast |
| The point forecast, across nodes | MAE as a percentage of the node's observed range, and MAE relative to a no-change forecast [Hyndman and Koehler 2006] | Comparable across nodes; lower is better |
| The whole forecast distribution | Continuous ranked probability score, computed from the five percentiles [Gneiting and Raftery 2007] | Reported as a ratio to no change; below 1 is better |
| The bands | Share of outcomes inside the 50% and 90% bands | Should be 50% and 90% |
| Large-change probabilities | Brier skill score against the historical rate [Brier 1950]; area under the ROC curve, computed within each node and averaged | Skill above 0 and area above 0.5 show information |

MAE is the headline measure because it is defined for every node and is easy to read.

**Uncertainty.** Forecasts for one country are not independent of each other, across years or across nodes. Confidence intervals therefore come from resampling whole countries [Cameron et al. 2008]. When two models are compared, both are scored on the same resampled countries.

## References

Provisional: written from memory, not yet checked against the sources.

Aitchison, J. 1986. *The Statistical Analysis of Compositional Data*. London: Chapman and Hall.

Barbieri, K., O. M. G. Keshk, and B. M. Pollins. 2009. Trading data: Evaluating our assumptions and coding rules. *Conflict Management and Peace Science* 26(5): 471-491.

Benjamini, Y., and Y. Hochberg. 1995. Controlling the false discovery rate: A practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society: Series B* 57(1): 289-300.

Blondel, V. D., J.-L. Guillaume, R. Lambiotte, and E. Lefebvre. 2008. Fast unfolding of communities in large networks. *Journal of Statistical Mechanics: Theory and Experiment* 2008(10): P10008.

Bollen, K. A. 1989. *Structural Equations with Latent Variables*. New York: Wiley.

Bolt, J., and J. L. van Zanden. 2024. Maddison-style estimates of the evolution of the world economy: A new 2023 update. *Journal of Economic Surveys*.

Brier, G. W. 1950. Verification of forecasts expressed in terms of probability. *Monthly Weather Review* 78(1): 1-3.

Bussmann, B., J. Nys, and S. Latré. 2021. Neural Additive Vector Autoregression Models for Causal Discovery in Time Series. In *Discovery Science (DS 2021)*, Lecture Notes in Computer Science 12986. Cham: Springer.

Cameron, A. C., J. B. Gelbach, and D. L. Miller. 2008. Bootstrap-based improvements for inference with clustered errors. *Review of Economics and Statistics* 90(3): 414-427.

Coppedge, M., et al. 2025. *V-Dem Country-Year Dataset v15*. Varieties of Democracy (V-Dem) Project. https://doi.org/10.23696/vdemds25

Diebold, F. X., and R. S. Mariano. 1995. Comparing predictive accuracy. *Journal of Business and Economic Statistics* 13(3): 253-263.

Gneiting, T., and A. E. Raftery. 2007. Strictly proper scoring rules, prediction, and estimation. *Journal of the American Statistical Association* 102(477): 359-378.

Goertz, G. 2003. *International Norms and Decision Making: A Punctuated Equilibrium Model*. Lanham: Rowman and Littlefield.

Goldstein, A., A. Kapelner, J. Bleich, and E. Pitkin. 2015. Peeking inside the black box: Visualizing statistical learning with plots of individual conditional expectation. *Journal of Computational and Graphical Statistics* 24(1): 44-65.

Granger, C. W. J. 1969. Investigating causal relations by econometric models and cross-spectral methods. *Econometrica* 37(3): 424-438.

Gygli, S., F. Haelg, N. Potrafke, and J.-E. Sturm. 2019. The KOF Globalisation Index - revisited. *Review of International Organizations* 14(3): 543-574.

Hyndman, R. J., and A. B. Koehler. 2006. Another look at measures of forecast accuracy. *International Journal of Forecasting* 22(4): 679-688.

Koenker, R., and G. Bassett. 1978. Regression quantiles. *Econometrica* 46(1): 33-50.

Kuskova, V., D. Zaytsev, and M. Coppedge. 2026a. Beyond coefficients: Forecast-necessity testing for interpretable causal discovery in nonlinear time-series models. *The International FLAIRS Conference Proceedings* 39(1). https://doi.org/10.32473/flairs.39.1.141791

Kuskova, V. V., D. Zaytsev, and M. Coppedge. 2026b. Function-Valued Causal Influence in Nonlinear Time Series. In *Proceedings of the 43rd International Conference on Machine Learning (ICML 2026)*. arXiv:2605.26408.

Lakshminarayanan, B., A. Pritzel, and C. Blundell. 2017. Simple and scalable predictive uncertainty estimation using deep ensembles. In *Advances in Neural Information Processing Systems 30*.

Lancichinetti, A., and S. Fortunato. 2012. Consensus clustering in complex networks. *Scientific Reports* 2: 336.

Schvitz, G., L. Girardin, S. Rüegger, N. B. Weidmann, L.-E. Cederman, and K. S. Gleditsch. 2022. Mapping the international system, 1886-2019: The CShapes 2.0 dataset. *Journal of Conflict Resolution* 66(1): 144-161.

Shrout, P. E., and J. L. Fleiss. 1979. Intraclass correlations: Uses in assessing rater reliability. *Psychological Bulletin* 86(2): 420-428.

United Nations, Department of Economic and Social Affairs, Population Division. 2024. *World Population Prospects 2024*.

Weidmann, N. B., D. Kuse, and K. S. Gleditsch. 2010. The geography of the international system: The CShapes dataset. *International Interactions* 36(1): 86-106.

World Bank. 2025. *World Development Indicators*. Washington, DC: World Bank.

Wu, Z., S. Pan, G. Long, J. Jiang, and C. Zhang. 2019. Graph WaveNet for deep spatial-temporal graph modeling. In *Proceedings of the 28th International Joint Conference on Artificial Intelligence (IJCAI)*, 1907-1913.

Yu, B., H. Yin, and Z. Zhu. 2018. Spatio-temporal graph convolutional networks: A deep learning framework for traffic forecasting. In *Proceedings of the 27th International Joint Conference on Artificial Intelligence (IJCAI)*, 3634-3640.
