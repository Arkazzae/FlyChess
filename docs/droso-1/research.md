# DROSO-1 Research Notes

**DROSO-1** was designed to answer a straightforward question: can a fresh model built on the [FlyWire FAFB v783](https://zenodo.org/records/10676866) female fruit-fly connectome learn competitive chess from scratch under a clean, reproducible training protocol?

Earlier prototypes (`fly-v4` and `fly-v6`, built on the MaleCNS v1.0 connectome) proved that a connectome-backed model could play legal, tactical chess in a browser, but their weights evolved across multiple warm-started stages where data mixtures, losses, and learning rates changed simultaneously. DROSO-1 resets the slate: all trainable weights, BatchNorm statistics, and optimizer states start from scratch on a fixed graph, sensory and action bugs from the earlier prototypes are fixed, and supervision choices are tested in a controlled A/B pilot.

---

## 1. What Changed from the Prototypes (`fly-v6` $\to$ `DROSO-1`)

| Dimension | Legacy `fly-v6` | `DROSO-1` |
| :--- | :--- | :--- |
| **Connectome** | MaleCNS v1.0 (163,903 neurons · 6.24M edges) | FlyWire FAFB v783 (134,181 neurons · 2.70M edges) |
| **Visual board coverage** | 50 of 64 squares (linear scaling of hexagonal eye columns left 14 corner squares blind) | **All 64 squares** via spatial band partitioning (`complete_square_map`) |
| **Square / global features** | 14 per square / 9 global | **15 per square** (adds legal en passant plane) / **22 global** (adds explicit unknown-clock & history flags) |
| **Action space** | 4,096 moves (`from * 64 + to`, queen promotions only) | **4,168 moves** (`4,096` standard/queen + `72` knight, bishop, and rook underpromotions) |
| **Reply target frame** | Ambiguous coordinate orientation on Black replies | Canonicalized in the replying player's perspective |
| **Deduplication** | Could overwrite DAgger blunder-cost labels | Preserves records with valid mistake costs and full game context |
| **Browser precision** | Quantised (int8 gains/readout, fp16 sensory/biases) | **Lossless FP32** with folded BatchNorm |

---

## 2. Controlled A/B Supervision Pilot

In earlier experiments, it was unclear whether auxiliary value targets ($+8$-ply future centipawns, game outcome WDL, and temporal consistency between value heads) helped or hurt move quality.

To test this cleanly, two arms (**Arm A** and **Arm B**) were initialized with identical random seeds (`2026092301`), identical batch sequences, identical optimizer hyperparameters, and identical per-row weighting on the current-CP value head:

| Arm | Supervised Targets |
| :--- | :--- |
| **Arm A** *(Auxiliary package)* | Move policy + opponent reply + current CP + DAgger mistake cost + **actual $+8$-ply future CP + game outcome + temporal consistency ($0.25$)** |
| **Arm B** *(Core package)* | Move policy + opponent reply + current CP + DAgger mistake cost |

Note that when future-CP or game-outcome labels were absent on a training record (such as single-position Lichess imports), they were strictly masked rather than backfilled with current CP.

### Pilot Results at 1,048,576 Presentations

Both arms were evaluated after 4,096 optimizer steps (1.05M presentations) on the 512-position validation split and in a 32-game head-to-head match at PUCT 64:

| Metric | Arm A | Arm B |
| :--- | ---: | ---: |
| **Severe errors on 512 validation positions** | 126 | **124** |
| **32-game head-to-head match** | 13 W · 7 D · 12 L | 12 W · 7 D · 13 L |

Because the auxiliary package in Arm A showed no measurable advantage on validation error count or match score, the predefined selection rule dropped the extra losses and continued **Arm B** for the full scaling run.

### Scaling Arm B to 26 Million Presentations

Arm B was trained through checkpoints at 4M, 8M, 16M, and 26M presentations:

| Presentations | Dev Severe Errors (/ 256) | Validation Severe Errors (/ 512) | Dev Match vs. `fly-v6` (16 games) |
| ---: | ---: | ---: | :---: |
| **1,048,576** | 60 | 124 | — |
| **4,000,000** | 33 | — | 3 W · 1 D · 12 L |
| **8,000,000** | 29 | 68 | 3 W · 2 D · 11 L |
| **16,000,000** | 29 | 56 | 8 W · 5 D · 3 L |
| **26,000,128** | **26** | **53** | **12 W · 1 D · 3 L** |

Before opening the held-out test set, the final candidate rule compared the 16M and 26M checkpoints on the 512-position validation set, selected the **26M checkpoint** (53 vs. 56 severe errors), and froze its weights as **DROSO-1**.

---

## 3. Held-Out Findings & Diagnostics

Full tables, confidence intervals, and PGN archives are documented in [`benchmarks/droso-1/README.md`](../../benchmarks/droso-1/README.md). The headline results show an interesting divergence between full-game play and single-position blunder counts:

1. **Head-to-head match vs. `fly-v6`:** Across 64 games from 32 held-out openings (both colours, PUCT 64), DROSO-1 defeated `fly-v6` **37 wins to 17 losses with 10 draws** (**65.6% score**, 95% source-game clustered CI: 56.5%–75.0%).
2. **Stockfish 19 rating probe:** Across 64 games against Stockfish 19 at `UCI_Elo` 1320 and 1500 (depth 8, 1 thread), DROSO-1 scored **61.7%** (33 W · 13 D · 18 L), corresponding to **1498.5 conditional Elo** (95% bootstrap CI: 1410–1603).
3. **Single-position move regret:** On the 512 held-out test positions evaluated by a common Stockfish 19 teacher, DROSO-1 committed **61 severe errors** (11.91%) with a mean regret of **85.94 cp**, compared with **56 severe errors** (10.94%) and **82.29 cp** for `fly-v6`. The 95% confidence intervals ($-5.33$ to $+2.07$ percentage points in error rate; $-46.00$ to $+14.04\text{ cp}$ in regret) cross zero—meaning that while DROSO-1 plays substantially stronger full games in head-to-head matches, its raw single-move regret on isolated test diagrams is statistically indistinguishable from `fly-v6`.
4. **Regression diagnostics:** Longer training improved overall game strength but did not monotonically fix every tactical blind spot. On a small 15-position tactical regression suite, the final 26M model solved 13/15 at PUCT 64 (whereas an intermediate checkpoint had reached 15/15 at PUCT 256), and retained a specific 671-cp blunder position where deeper search failed to override a bad prior.

---

## 4. What This Does and Does Not Prove

### Gradients Reach the Connectome, Not Just the Readout

In the frozen 26M checkpoint, **1,780,206 of the 2,700,513 connectome edges (65.9%)** have non-zero learned log-gains $g_e$. Combined with the 10-step recurrent bottleneck between the optic lobes and the readout electrodes, this confirms that backpropagation actively tunes the connectome's internal pathways rather than leaving the graph inert. At the same time, because log-gains are regularized ($10^{-3}\,\overline{g^2}$) and trained at $2\times 10^{-5}$, 90% of edge multipliers $\exp(g_e)$ stay within **0.98×–1.02×** of their biological synapse counts (see [How Much of the Fly Is Actually Left?](../../README.md#wait-how-much-of-the-fly-is-actually-left)).

### Limitations & Next Experiments

1. **No topology-only ablation yet:** Comparing DROSO-1 against `fly-v6` changes the connectome (FlyWire v783 vs. MaleCNS v1.0), the visual mapping (64 vs. 50 squares), the action space (4,168 vs. 4,096 moves), and the training recipe simultaneously. Isolating how much the biological wiring helps (or constrains) chess learning requires matched controls—specifically:
   - a **frozen-connectome reservoir baseline** ($g_e = 0, b_i = 0$, training only the sensory and readout layers), and
   - a **degree-preserving random/shuffled graph control** with identical parameter counts and readout architecture.
2. **Single seed & holdout reuse:** The pilot and scaling run used a single initialization seed (`2026092301`). Because the 512-position `test` split has now been opened and published in `benchmarks/droso-1/`, future model selection should draw a fresh holdout set.
3. **Historical source-game provenance:** While DROSO-1's training pool excluded held-out roots, legal children, and known source games, some legacy imported shards lacked original game IDs, and `fly-v6` may have seen some test positions during its earlier historical training.

---

## 5. Primary Sources

- **Connectome data:** FlyWire Consortium, [FAFB v783 connectivity release](https://zenodo.org/records/10676866) (CC BY 4.0); exact file hashes and scientific citations are pinned in [`artifacts/droso-1/graph-provenance.json`](../../artifacts/droso-1/graph-provenance.json).
- **Reproduction & archive:** Step-by-step commands in [`docs/droso-1/recipe.md`](recipe.md); archived experiment manifests and PGNs in [`benchmarks/droso-1/provenance.json`](../../benchmarks/droso-1/provenance.json).
