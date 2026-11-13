# Training DROSO-1

**DROSO-1** was trained from scratch on the fixed FlyWire v783 connectome for **101,563 optimizer steps** (**26,000,128 sampled position presentations**, batch size 256).

This directory and [`training/`](../training/README.md) contain the complete Python pipeline used to prepare the training corpus, train the connectome parameters and readout, evaluate checkpoints against Stockfish and historical baselines, and export the weights to the browser.

---

## Where to Start

| Goal | Document |
| :--- | :--- |
| **Run the pretrained model in Python** | **[Pretrained Bundle (`artifacts/droso-1/`)](../artifacts/droso-1/README.md)** — runs on CPU or CUDA with no Stockfish dependency or training corpus required. |
| **Train a new model from scratch** | **[Training Recipe](droso-1/recipe.md)** — environment setup, corpus generation, data preparation, training commands, and browser export. |
| **Understand the experimental design** | **[Research Notes](droso-1/research.md)** — why the pipeline was rebuilt after `fly-v6`, the controlled A/B supervision pilot, and known limitations. |
| **Inspect ratings, PGNs, and error audits** | **[Benchmark Archive (`benchmarks/droso-1/`)](../benchmarks/droso-1/README.md)** — the ~1500 Elo Stockfish 19 probe, 64-game match vs. `fly-v6`, and 512-position regret tables. |
| **Explore the Python codebase** | **[Python Pipeline (`training/`)](../training/README.md)** — module layout and unit test commands. |

---

## Supervision Summary

During training, the connectome's 134,181 neurons and 2,700,513 directed connections remain topologically fixed. AdamW optimizes four parameter groups:
1. **Per-connection log-gains** ($2.70\text{M}$ parameters) and **per-neuron biases** ($134\text{k}$ parameters), trained at learning rate $2\times 10^{-5}$.
2. **Sensory projections** ($446\text{k}$ parameters) and **readout MLP + heads** ($8.41\text{M}$ parameters including auxiliary heads), trained at learning rate $6\times 10^{-5}$.

Each batch mixes positions from three sources:
- **Lichess evaluation database (~60.5% sampling share):** Positions with deep Stockfish MultiPV evaluations.
- **DAgger mistake collection (~32.4% sampling share):** Positions from model games where an earlier move lost $\ge 100\text{ cp}$, providing targeted negative feedback on blunders.
- **Stockfish self-play (~7.1% sampling share):** Full game trajectories with reply and outcome context.

The released checkpoint (**Arm B** of the v10 experiment) supervises four targets:
- **Move policy** (soft cross-entropy over Stockfish MultiPV lines across all 4,168 moves, including underpromotions),
- **Current position value** ($\tanh(\text{cp} / 600)$ from the side to move),
- **Opponent reply prediction** (auxiliary head over 4,168 moves), and
- **DAgger mistake penalty** (penalizing probability mass placed on known costly moves).

During actual gameplay, PUCT search uses only the **move policy** and **current position value**.

---

## System Requirements

- **Inference only (`artifacts/droso-1/`):** Python 3.12 on CPU or CUDA; no Stockfish installation needed.
- **Full training & evaluation (`training/`):** Linux or WSL2, Python 3.12, a CUDA-capable NVIDIA GPU (~4 GB VRAM minimum; originally trained on an RTX 4070 SUPER at ~1,285 positions/s), native Stockfish 19 (`STOCKFISH_EXECUTABLE`), and ~25 GB of disk space for shards and memory-mapped datasets.
