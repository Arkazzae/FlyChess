# DROSO-1 Training Recipe

This guide walks through reproducing the **DROSO-1** training pipeline from scratch: setting up the environment, assembling the three-source training corpus, preparing memory-mapped splits, training the connectome and readout weights, running Stockfish evaluations, and exporting the final bundle to the browser.

> [!NOTE]
> If you only want to run or inspect the already-trained model, use the standalone bundle in [`artifacts/droso-1/`](../../artifacts/droso-1/README.md). Because the original 10.26M-position corpus and AdamW optimizer state are not redistributed in git, training on a newly generated corpus will produce a fresh set of weights rather than bit-identical tensors. Historical logs and evaluation outputs from the released run are archived in [`benchmarks/droso-1/`](../../benchmarks/droso-1/README.md).

---

## 1. Environment Setup

### Prerequisites

- **OS & Python:** Linux or WSL2 with Python 3.12.
- **GPU:** CUDA-capable NVIDIA GPU. A full-graph run allocates ~3.8 GB of VRAM before runtime overhead; on an RTX 4070 SUPER, training runs at ~1,285 position presentations per second.
- **Tools:** Native **Stockfish 19** binary (for data labelling and benchmark evaluation), `curl`, and `zstd` (for streaming Lichess evaluations).
- **Disk:** At least 25 GB free for shards, memory-mapped arrays, and checkpoints.

### Installation & Unit Tests

From the repository root:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r training/requirements.txt

cd training
export STOCKFISH_EXECUTABLE=/absolute/path/to/stockfish
python -m unittest discover -s droso1 -t . -p 'test_*.py'
python -m unittest test_training_state
```

Ensure your PyTorch build matches your CUDA driver:

```bash
python -c "import torch; print(torch.cuda.is_available())"
```

The fixed FlyWire v783 connectome graph is read directly from `../artifacts/droso-1/graph.npz` (verified via SHA-256 on startup). Every new training run initializes fresh trainable parameters on top of that graph.

---

## 2. Corpus Assembly

Training expects compressed NumPy shards (`.npz`) inside `training/data/shards/`. Each shard stores a `records` array using the structured dtype defined in [`training/generate.py`](../../training/generate.py). The pipeline identifies the data source from the shard filename:
- `*lichess*.npz` — positions imported from the Lichess evaluation database,
- `*dagger*.npz` — positions collected from model games with Stockfish blunder costs,
- all other `*.npz` — Stockfish self-play games.

### Generating a New Corpus

Run the three data generators from `training/`:

```bash
mkdir -p data/shards

# 1. Stockfish self-play trajectories
python generate.py --out data/generated --workers 2 --target 1900000 --depth 12

# 2. Lichess positions with deep Stockfish evaluations
python import_lichess.py --out data/lichess --positions 8000000 --min-depth 18

# 3. DAgger mistake collection (queries Stockfish on model moves)
python -m droso1.collect --bundle ../artifacts/droso-1 --out data/dagger \
  --games 48 --rounds 1000 --labellers 2 --depth 10

cp data/generated/*.npz data/lichess/*.npz data/dagger/*.npz data/shards/
```

### Reference Corpus Composition

In the original DROSO-1 training run, the audited corpus contained **10,263,924 unique positions**, sampled at fixed mixture weights independent of source size:

| Source | Unique Positions | Sampling Share | Notes |
| :--- | ---: | ---: | :--- |
| **Lichess evaluations** | 7,534,648 | **60.496%** | MultiPV move targets and current CP |
| **DAgger mistakes** | 965,712 | **32.393%** | Includes 264,336 costly-move penalty labels ($\ge 100\text{ cp}$ loss) |
| **Generated games** | 1,763,564 | **7.111%** | Includes 1,612,484 future-CP labels ($+8$ plies) and 1,763,564 game outcomes |
| **Total** | **10,263,924** | **100.000%** | 9,957,182 records include a valid opponent reply label |

> [!IMPORTANT]
> Split construction reserves 12 DAgger, 6 generated, and 3 Lichess shards for held-out evaluation (stratified across quiet, tactical, and endgame positions), and requires additional shards of each type for training. If you build a miniature corpus for testing, make sure all three sources have enough shards to satisfy those split quotas.

---

## 3. Data Preparation, Deduplication & Audit

Convert the raw shards into memory-mapped training arrays and held-out splits:

```bash
python -m droso1.prepare --shards data/shards --out data/droso-1 --workers 2
python -m droso1.reindex --data data/droso-1
python -m droso1.audit --data data/droso-1
```

What each step does:
1. **`droso1.prepare`:** Validates FENs and legal target moves, reserves `dev` (256), `validation` (512), and `test` (512) position pools plus `8 / 16 / 32` match openings (played with both colours), and strips held-out root positions, their immediate legal children, and known source groups from the training pool.
2. **`droso1.reindex`:** Deduplicates training positions globally by canonical board key (`FEN` fields 1–4 with legal en passant). When duplicates exist, it prioritizes records with a valid DAgger mistake cost, then records with full game context, then deterministic source order.
3. **`droso1.audit`:** Verifies SHA-256 checksums, move legality, sampler index integrity, split isolation, and sample reconstruction against the original shards.

---

## 4. Training

To train the released **Arm B** configuration to 26 million position presentations:

```bash
python -m droso1.train --data data/droso-1 --run runs/my-droso-1 \
  --arms B --target-seen 26000128
```

For a quick smoke test of the pipeline, pass `--max-steps 4` in a disposable directory. To run the paired A/B supervision comparison described in the [research notes](research.md), pass `--arms A B --target-seen 1048576`.

### Hyperparameters

| Parameter | Value |
| :--- | :--- |
| **Random seed** | `2026092301` |
| **Batch size** | `256` positions (`101,563` steps for `26,000,128` presentations) |
| **Recurrent dynamics / BPTT** | `10` propagation steps from rest; gradients flow through the **last 4 steps** |
| **Sparse edge-gradient subsample** | `96` randomly sampled batch items per step (rescaled unbiased estimator; forward pass uses all edges and full batch) |
| **Readout architecture** | `7,526` electrodes $\to$ `BatchNorm1d` $\to$ `512` $\to$ `512` (Quick-GELU residual) |
| **Optimizer** | `AdamW` ($\beta_1 = 0.9$, $\beta_2 = 0.98$), global grad-norm clip `1.0` |
| **Learning rate (gains & biases)** | `2e-5` (weight decay `0.0`) |
| **Learning rate (sensory & readout)** | `6e-5` (weight decay `1e-4`) |
| **LR schedule** | Linear warmup over `400` steps, then constant |
| **Connectome gain regularization** | $0.001 \times \operatorname{mean}(g_e^2)$ |
| **BatchNorm calibration** | Re-estimated on a fixed 3,072-position training pool before saving checkpoints |

### Loss Formulation ([`training/droso1/loss.py`](../../training/droso1/loss.py))

- **Policy loss:** Stockfish MultiPV lines form a soft target distribution at temperature $120\text{ cp}$ over the 4,168-action space. The loss combines $0.6 \times \text{cross-entropy over legal moves}$ and $0.4 \times \text{cross-entropy over all 4,168 logits}$.
- **Current value loss:** Mean squared error against $v_{\text{target}} = \tanh(\text{cp} / 600)$ from the side to move. Each row carries weight $2 / k$, where $k \in \{1, 2, 3\}$ counts how many value labels (current CP, $+8$-ply future CP, game outcome) exist on that record. Arm B trains only the current-CP head while keeping the $2/k$ row weighting so its current-CP gradient scale matches Arm A identically.
- **Example weighting:** Policy and value losses weight positions by $2.5\times$ when flagged by the sacrifice heuristic, $1.5\times$ for the poisoned-capture heuristic, and $1.0\times$ otherwise (normalized by the batch weight sum).
- **Reply loss (weight `0.5`):** Cross-entropy over the 4,168-action reply head in the replying player's coordinate frame, averaged over records with a valid reply move.
- **DAgger mistake loss (weight `0.5`):** For recorded moves that lost $\ge 100\text{ cp}$, penalizes $-\log(1 - p_{\text{bad}}) \times \min(\text{cost}, 600) / 300$, summed over valid mistake records and divided by the batch size.

### Pausing & Resuming

Gracefully stop a training run at the next step boundary by creating a `PAUSE` file in the run directory (`touch runs/my-droso-1/PAUSE`), pressing `Ctrl+C`, or sending `SIGTERM`. Resume with `--resume`:

```bash
python -m droso1.train --data data/droso-1 --run runs/my-droso-1 \
  --arms B --target-seen 26000128 --resume
```

`--target-seen` specifies cumulative presentations (must be a multiple of 256). On resume, the trainer verifies code, data, and connectome SHA-256 hashes and restores the exact sampler step, RNG state, and AdamW moments from `last.pt`.

---

## 5. Evaluation & Export

### Validation & Common-Teacher Regret Analysis

Evaluate a checkpoint's single-move regret (on 512 positions) and paired 64-game match performance against the released bundle:

```bash
python -m droso1.evaluate --checkpoint runs/my-droso-1/last.pt --arms B \
  --bundle ../artifacts/droso-1 --data data/droso-1 --split validation \
  --games --out runs/my-droso-1-validation

python -m droso1.harmonize \
  --input candidate=runs/my-droso-1-validation/fresh_B-regret.json \
  --input release=runs/my-droso-1-validation/DROSO-1-regret.json \
  --out runs/my-droso-1-validation/common-teacher
```

`droso1.harmonize` re-evaluates chosen moves under a shared Stockfish node budget and root analysis so both models are judged by an identical teacher. Once a candidate is finalized on `validation`, run a single held-out test pass with `--split test --final`.

### Standalone Bundle & Stockfish Rating Probe

Export a self-contained Python inference bundle (`weights.npz`, `graph.npz`, runtime code, and `verification.json`):

```bash
python -m droso1.export --checkpoint runs/my-droso-1/last.pt --arm B \
  --out exports/my-droso-1

# Run a 32-game rating match against Stockfish 19 at a target UCI_Elo
python -m droso1.rating_match --bundle exports/my-droso-1 --elo 1500 \
  --out runs/my-droso-1-rating-1500
```

### Browser Export

To export a verified bundle into `public/data/` (`connectome.bin.gz`, `weights.bin.gz`, manifests, and parity test fixtures) and run the full test suite from the repository root:

```bash
PYTHONPATH=training python -m droso1.export_browser --bundle artifacts/droso-1
pnpm check
CHROMIUM_PATH=/usr/bin/chromium pnpm test:fly:browser
```

The browser exporter folds BatchNorm statistics into linear scale/shift constants, preserves full FP32 precision, attaches the 117,708 soma coordinates from FlyWire annotations v2.1.0 (downloading and verifying the TSV automatically, or reading from `--annotations`), and writes PyTorch parity fixtures consumed by Vitest (`src/ai/fly/parity.test.ts`).
