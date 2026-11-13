# `fly-v4` (Legacy Prototype)

> [!NOTE]
> **Archived prototype.** FlyChess now runs **[DROSO-1](../../droso-1/README.md)** on the FlyWire v783 connectome. `fly-v4` is an earlier MaleCNS v1.0 prototype ([`../mcns/`](../mcns/)) preceding [`fly-v6`](../fly-v6/README.md).

| Property | Value |
| :--- | :--- |
| **Connectome** | MaleCNS v1.0 (`163,903` neurons · `6,235,682` edges) |
| **Training steps** | `25,475` (`6,521,600` position presentations) |
| **Training date** | 18–19 Sep 2026 |
| **Weights SHA-256** | `8243c4a15481bf96a978442def509f15226d33469b7a9d495f6881939cc736b7` |
| **Connectome SHA-256** | `e7c39f014763a2d6aa4eb1fe2041820b46d60918020b2301dc8f409990246745` |

## Training Summary

Warm-started from `fly-v3` with three adjustments:
- Doubled the Lichess evaluation share in the data mixture,
- Weighted legal-move cross-entropy at 60% of the total policy loss,
- Added a temporal consistency term across its three value heads.

## Historical Benchmark Results

Evaluated across 96 games per level against Stockfish 1320 ($\pm 65$ Elo):

| Legacy Level | Record (W · D · L) | Estimated Elo |
| :--- | :---: | ---: |
| **Reflex** (policy only) | 9 W · 12 D · 75 L | 1027 |
| **Planner** ($3 \times 2$ search) | 44 W · 12 D · 40 L | 1334 |
| **Thinker** ($6 \times 4$ search) | 45 W · 12 D · 39 L | 1342 |

Without tree search (`Reflex`), `fly-v6` improved on `fly-v4` by roughly 90 Elo; with shallow tree search, both models scored within the $\pm 65$ uncertainty margin.
