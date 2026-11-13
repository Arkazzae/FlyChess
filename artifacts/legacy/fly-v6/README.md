# `fly-v6` (Legacy Prototype)

> [!NOTE]
> **Archived prototype.** FlyChess now runs **[DROSO-1](../../droso-1/README.md)** on the FlyWire v783 connectome. `fly-v6` is retained as the historical baseline from the MaleCNS v1.0 experiments ([`../mcns/`](../mcns/)).

| Property | Value |
| :--- | :--- |
| **Connectome** | MaleCNS v1.0 (`163,903` neurons · `6,235,682` edges) |
| **Training steps** | `61,465` (`15,735,040` position presentations) |
| **Training date** | 18–21 Sep 2026 (~3 hours for the v5 $\to$ v6 stage on an RTX 4070 SUPER) |
| **Weights SHA-256** | `2c4a64df6d61b832d709b8a17edee35e0b798a330c01d7be3d99ea0561f1413f` |
| **Connectome SHA-256** | `e7c39f014763a2d6aa4eb1fe2041820b46d60918020b2301dc8f409990246745` |

## Training Summary

`fly-v6` was warm-started from `fly-v5` (which descended from `v1–v4`) and trained from 8.8M to 15.7M presentations at a constant low learning rate on a three-source mix:
- **60%** Lichess positions analysed by Stockfish,
- **32%** DAgger positions from its own games with blunder-cost penalties,
- **7%** Stockfish self-play.

## Historical Benchmark Results

Evaluated across 96 games per level against Stockfish 1320 ($\pm 65$ Elo):

| Legacy Level | Record (W · D · L) | Estimated Elo |
| :--- | :---: | ---: |
| **Reflex** (policy only) | 13 W · 19 D · 64 L | 1114 |
| **Planner** ($3 \times 2$ search) | 33 W · 17 D · 46 L | 1273 |
| **Thinker** ($6 \times 4$ search) | 42 W · 9 D · 45 L | 1309 |

On held-out positions, `fly-v6`'s top policy choice matched Stockfish's best move **28.6%** of the time (top-3 match **52.3%**, unmasked top-1 legality **89.4%**). In the subsequent [held-out PUCT-64 match](../../../benchmarks/droso-1/README.md#2-held-out-match-vs-legacy-fly-v6), DROSO-1 defeated `fly-v6` **37–10–17**.
