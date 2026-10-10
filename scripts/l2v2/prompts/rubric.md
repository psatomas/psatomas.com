# L2 quality rubric (v2)

Distilled from the Foundations L2 audits: every first draft there failed on these, and repairs introduced
them anew. A **defect** is any failure of rules R1–R12; it blocks publication. Taste is a remark, never a defect.
Rule ids are used in findings (`rule`).

| id | Rule | Test |
|---|---|---|
| conditions | Every guarantee states the conditions it holds under: fault model, timing model, who holds or knows what, determinism, honest-majority or threshold assumptions. | For each "guarantees / ensures / cannot / always", name the condition; none stated → defect. |
| overclaim | No claim wider than the truth, including implied overclaims ("only", "never", "every", "exactly", "typically", "also", "is enough", "proves", comparatives). | Find one real design or case that breaks the sentence → defect. |
| formal-results | Impossibility, threshold and soundness results carry all their conditions (e.g. deterministic, crash vs Byzantine, synchronous vs partial synchrony, validity variant, signatures, setup). | Missing any condition that the result needs → defect. |
| definition | The definition fits every case, reading and placement the record itself discusses. | A paragraph contradicts or exceeds the definition → defect. |
| summary | A summary or umbrella sentence agrees with the conditioned sentences it summarizes. | Summary stronger than its parts → defect. |
| one-sense | Each term keeps one sense in the record; a narrowed term is rechecked wherever it appears. | Same word, two meanings → defect. |
| examples | Examples fit the category they illustrate and are true as stated. | Example belongs to another case → defect. |
| causation | Causal and inferential direction is right ("because", "so", "which is why"). | Reversed or unsupported inference → defect. |
| territory | Siblings' claims, excluded and reserved concepts, and other domains' concepts are named only, never explained (not even by paraphrase). | A sentence a neighbour's record would own → defect. |
| parent | No restatement or paraphrase of a parent's or the domain's sentence about this concept. | Same point as a parent sentence → defect. |
| coverage | Each plan claim is explained: its mechanism, the conditions it holds under, and how it fails or what it is confused with. A claim only named is too thin. | Any of the three missing for a claim → defect. Length alone is never a defect. |
| structure | Structured blocks are exactly the design, add what prose does not, and the prose does not walk their rows. | Restating block or wrong form → defect. |
| economy | No point made twice, no announcing setup, no repeating conclusion. | A repeated point → defect (one sentence to cut). |
| form | American English, plain text, no positional words ("above", "below", "this domain"), no dated words ("currently", "new", "latest"). | Deterministic checks catch most; remaining → defect. |

Depth: explanations follow the claims' mechanisms, not a length. Polished generality that names mechanisms without
explaining them fails `coverage`. Prefer cutting a doubtful clause to hedging it.
