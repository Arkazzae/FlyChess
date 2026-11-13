# DROSO-1 Benchmarks

This directory archives the evaluation results, game PGNs, and position-level regret audits for the released **DROSO-1** model (trained for 101,563 steps / 26,000,128 position presentations, frozen on 23 September 2026).

Unless noted otherwise, DROSO-1 plays with **64 PUCT simulations**, $c_{\text{puct}} = 1.5$, current-CP value evaluation ($\tanh(\text{cp} / 600)$), and no per-move time limit.

---

## 1. Stockfish 19 Conditional Rating Probe

DROSO-1 played 64 games (16 openings × both colours × 2 opponent levels) against Stockfish 19 configured with `UCI_LimitStrength=true`, search depth 8, 1 thread, and 16 MB hash:

| Opponent | Wins | Draws | Losses | Score | Conditional Performance |
| :--- | ---: | ---: | ---: | ---: | ---: |
| **Stockfish 19 (`UCI_Elo 1320`, depth 8)** | 21 | 5 | 6 | 73.44% | 1496.66 |
| **Stockfish 19 (`UCI_Elo 1500`, depth 8)** | 12 | 8 | 12 | 50.00% | 1500.00 |
| **Combined (64 games)** | **33** | **13** | **18** | **61.72%** | **1498.54** |

- **95% bootstrap confidence interval:** **1410.00 – 1603.33** (resampled across 13 opening families across both colours and opponent levels).
- **Game completion:** All 64 games ended naturally by checkmate or standard draw rules with distinct move trajectories well inside the 512-ply safety cap.
- **Calibration note:** Stockfish calibrates `UCI_Elo` at $120\text{ s} + 1\text{ s/move}$ time controls ([UCI documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html)), so this ~1500 figure measures strength specifically under this fixed-depth protocol rather than a FIDE, Lichess, or Chess.com pool rating.

**Archived evidence:**
- Summary & intervals: [`rating/rating.json`](rating/rating.json), [`rating/protocol.json`](rating/protocol.json), [`rating/audit.json`](rating/audit.json)
- Vs. Stockfish 1320: [`rating/sf1320/report.json`](rating/sf1320/report.json) · [`rating/sf1320/games.pgn`](rating/sf1320/games.pgn)
- Vs. Stockfish 1500: [`rating/sf1500/report.json`](rating/sf1500/report.json) · [`rating/sf1500/games.pgn`](rating/sf1500/games.pgn)

To recompute the summary statistics from the archived match reports (runs on CPU from `training/`):

```bash
python -m droso1.rating_summary \
  --input ../benchmarks/droso-1/rating/sf1320/report.json \
  --input ../benchmarks/droso-1/rating/sf1500/report.json \
  --out /tmp/droso-1-rating.json
```

---

## 2. Held-Out Match vs. Legacy `fly-v6`

Across 64 games played from 32 held-out openings (sourced from 19 distinct games, each played as White and Black at PUCT 64), DROSO-1 defeated the earlier MaleCNS-based `fly-v6` model:

| Matchup | Wins | Draws | Losses | Points | Score | 95% Clustered CI |
| :--- | ---: | ---: | ---: | ---: | ---: | :---: |
| **DROSO-1 vs. `fly-v6` (PUCT 64)** | **37** | **10** | **17** | 42 / 64 | **65.63%** | 56.45% – 75.00% |

All 64 games terminated naturally without adjudication. Both engines used 64 PUCT simulations (`fly-v6` using its native multi-head value mixture).

**Archived evidence:** [`final-test/games.pgn`](final-test/games.pgn) · [`final-test/report.json`](final-test/report.json) · [`final-test/source-game-audit.json`](final-test/source-game-audit.json)

---

## 3. Held-Out Single-Move Quality (512 Positions)

On the 512 held-out test positions, Stockfish 19 evaluated the move chosen by each model at PUCT 64 using a harmonized common-teacher budget (200,000 nodes baseline, escalated to 1,000,000 nodes on borderline cases):

| Metric | DROSO-1 | `fly-v6` | Difference (95% Clustered CI) |
| :--- | ---: | ---: | :---: |
| **Severe errors (all 512 positions)** | 61 (11.91%) | 56 (10.94%) | $+0.98\text{ pp}$ ($-5.33$ to $+2.07$) |
| **Mean regret (448 common-CP positions)** | 85.94 cp | 82.29 cp | $+3.65\text{ cp}$ ($-46.00$ to $+14.04$) |
| **Quiet-position severe errors (/ 258)** | 26 | 25 | — |
| **Tactical-position severe errors (/ 127)** | 20 | 20 | — |
| **Endgame severe errors (/ 127)** | 15 | 11 | — |

- A **severe error** is defined as losing $\ge 300\text{ cp}$, missing a forced mate, or stepping into a forced mate according to Stockfish 19.
- The 64 positions involving forced-mate scores are included in the severe-error count and excluded from the 448-position centipawn mean so mate scores are not conflated with centipawns.
- Because both confidence intervals span zero, single-position test regret does not separate the two models statistically, even though DROSO-1 wins 65.6% of full head-to-head games. (Note: `final-test/report.json` stores the initial adaptive-budget teacher pass with 57 vs. 55 errors; the table above reports the harmonized common-teacher pass in `final-test/common-teacher/report.json`.)

**Archived evidence:** [`final-test/common-teacher/report.json`](final-test/common-teacher/report.json) · [`final-test/common-teacher/fresh_B-regret.json`](final-test/common-teacher/fresh_B-regret.json) · [`final-test/common-teacher/historical_v6-regret.json`](final-test/common-teacher/historical_v6-regret.json) · [`final-test/paired-v6.json`](final-test/paired-v6.json)

---

## 4. Training Progression & Checkpoint Selection

Arm B was evaluated across five training milestones on the 256-position `dev` split, the 512-position `validation` split, and 16-game `dev` matches against `fly-v6`:

| Presentations | Optimizer Steps | Dev Severe Errors (/ 256) | Validation Severe Errors (/ 512) | Dev Match vs. `fly-v6` (W / D / L) |
| ---: | ---: | ---: | ---: | :---: |
| **1,048,576** | 4,096 | 60 | 124 | — |
| **4,000,000** | 15,625 | 33 | — | 3 / 1 / 12 |
| **8,000,000** | 31,250 | 29 | 68 | 3 / 2 / 11 |
| **16,000,000** | 62,500 | 29 | 56 | 8 / 5 / 3 |
| **26,000,128** | 101,563 | **26** | **53** | **12 / 1 / 3** |

Under the predefined selection rule ([`training/final-selection-protocol.json`](training/final-selection-protocol.json)), the 16M and 26M candidates were compared on `validation` before opening `test`. The 26M checkpoint achieved the lowest validation severe-error count (53 vs. 56; difference $-0.59\text{ pp}$, 95% CI $-2.60$ to $+1.28$) and was frozen as the release model ([`training/final-candidate.json`](training/final-candidate.json)).

**Archived evidence:**
- Dev progression: [`growth-B-26000128/common-teacher/report.json`](growth-B-26000128/common-teacher/report.json)
- 1M A/B pilot: [`validation-common-teacher/report.json`](validation-common-teacher/report.json) · [`pilot-validation/games.pgn`](pilot-validation/games.pgn)
- Final validation (8M / 16M / 26M): [`validation-final-common-teacher/report.json`](validation-final-common-teacher/report.json) · [`validation-final-common-teacher/paired-16m-26m.json`](validation-final-common-teacher/paired-16m-26m.json)

---

## 5. Archive Layout & Provenance

- **[`data/`](data/):** Held-out `dev.npy`, `validation.npy`, and `test.npy` position arrays, match openings (`openings.json`), and dataset audit logs.
- **[`training/`](training/):** Frozen training recipe (`recipe.json`), post-training audit (`post-26m-audit.json`), selection protocol, and original export verification.
- **[`provenance.json`](provenance.json):** Maps every file in this archive to its original experiment identifier (`v10`, `fresh_B`, `historical_v6`) and SHA-256 hash.
- **[`port-training-verification.json`](port-training-verification.json):** Records a full-graph verification test of the standalone `training/droso1` code port (paired A/B init, B-only resume, exact sampler continuation, and bundle export).
