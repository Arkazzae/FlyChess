# DROSO-1 Standalone Inference Bundle

This directory is a self-contained Python inference package for **DROSO-1**, the connectome-backed chess model running in FlyChess. It includes the FlyWire v783 graph, lossless FP32 weights, the Python inference runtime, and SHA-256 verification fixtures—with no dependency on Stockfish or the training workspace.

---

## Model Specification

| Property | Value |
| :--- | :--- |
| **Connectome** | FlyWire FAFB v783 (`134,181` neurons · `2,700,513` directed edges · `34,153,566` synapses) |
| **Training exposure** | `101,563` steps (`26,000,128` position presentations, Arm B) |
| **Trainable parameters** | `11,690,393` total (`9,551,183` active during search; `2,834,694` inside the connectome) |
| **Sensory encoding** | `64 × 15` visual square channels ($\to 22,586$ neurons) + `22` global features ($\to 4,885$ neurons) |
| **Recurrent dynamics** | `10` steps from rest ($\alpha = 0.65$, $\kappa = 0.95$) |
| **Readout & policy** | `7,526` electrodes $\to$ `BatchNorm1d` $\to$ `512` $\to$ `512` $\to$ `4,168` moves (all 4 promotion types) |
| **Default search** | PUCT (`64` simulations, $c_{\text{puct}} = 1.5$, value head $\tanh(\text{cp} / 600)$) |
| **Benchmarks** | **~1500 conditional Elo** (95% CI: 1410–1603) vs. depth-8 Stockfish 19; **37–10–17** vs. `fly-v6` ([details](../../benchmarks/droso-1/README.md)) |

---

## Quick Start (Python 3.12)

From the repository root:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r artifacts/droso-1/requirements.txt

cd artifacts/droso-1
python -m droso1.bundle --device cpu --moves e2e4 c7c5
```

- Pass `--device cuda` if you have a CUDA-enabled PyTorch installation.
- Set a starting board with `--fen '...'` and apply subsequent moves with `--moves e2e4 c7c5 ...` (preserving repetition history).
- Pass `--unknown-clock` when evaluating an imported FEN whose 50-move counter is unknown.
- Adjust the search budget with `--simulations N` (defaults to `64`).
- The command outputs JSON containing the selected move (`uci` and `san`), current value estimate (`current_cp_tanh`), and unsearched policy probabilities over all legal moves (`legal_policy`).

---

## Integrity & Output Verification

Run the built-in verification check from `artifacts/droso-1/`:

```bash
python -m droso1.verify
```

`droso1.verify` validates:
1. Every file's SHA-256 hash against [`manifest.json`](manifest.json),
2. Strict state-dict tensor shapes and exact equality of fixed anatomical buffers (`crow`, `col`, `base`, `norm`, `vis_square`, `readout_index`), and
3. CPU FP32 forward-pass parity (`rtol=1e-5, atol=1e-5`) against the PyTorch reference outputs in `parity.npz` across seven test positions (covering both colours, en passant, promotions, and unknown halfmove clocks).

Release verification results are recorded in [`verification.json`](verification.json). Note that this inference bundle omits optimizer (`AdamW`) and sampler states; to train a new model from scratch, follow the [training recipe](../../docs/droso-1/recipe.md).

---

## Browser Export & Data Licences

The web app runs a matching lossless FP32 binary export of this bundle (`public/data/droso-1/` and `public/data/flywire/`); see the [development guide](../../docs/development.md#4-updating-the-browser-model) for export commands.

- **Code & trained weights:** [MIT](../../LICENSE) (original runtime notice in [`LICENSE`](LICENSE)).
- **Connectome (`graph.npz`):** Derived from the FlyWire Consortium's [FAFB v783 release](https://zenodo.org/records/10676866) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Full upstream checksums and scientific citations are recorded in [`graph-provenance.json`](graph-provenance.json).
