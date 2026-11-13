# Pretrained Connectome Models

This directory stores the standalone **DROSO-1** inference bundle used by FlyChess alongside archived weights from earlier prototypes.

---

## 1. DROSO-1 (Current Release)

**[`droso-1/`](droso-1/README.md)** is the self-contained Python inference package for the model running in the web app:
- Built on the **FlyWire FAFB v783** female *Drosophila* connectome (134,181 neurons · 2,700,513 directed connections).
- Trained from scratch for **101,563 steps** (26,000,128 position presentations).
- Covers all 64 squares with 15 visual channels per square, 22 global features, and 4,168 move actions (including all underpromotions).
- Scored **~1500 conditional Elo** (95% CI: 1410–1603) against depth-limited Stockfish 19 and defeated `fly-v6` **37–10–17** in a 64-game held-out match ([benchmark details](../benchmarks/droso-1/README.md)).

See **[`droso-1/README.md`](droso-1/README.md)** for instructions on running and verifying the bundle in Python, or the **[training recipe](../docs/droso-1/recipe.md)** to train a new model from scratch.

---

## 2. Legacy Prototypes (`legacy/`)

> [!NOTE]
> `fly-v6` and `fly-v4` are early prototypes kept for historical comparison and benchmark reproducibility. They use the **MaleCNS v1.0** connectome ([`legacy/mcns/`](legacy/mcns/)), an older 50-square visual mapping, and a 4,096-move action space, and are not loaded by the current web application.

| Model | Trained | Presentations | Legacy Probe Elo (Reflex / Planner / Thinker) |
| :--- | :--- | ---: | :--- |
| **[`fly-v6`](legacy/fly-v6/README.md)** | 18–21 Sep 2026 | 15,735,040 | 1114 / 1273 / 1309 |
| **[`fly-v4`](legacy/fly-v4/README.md)** | 18–19 Sep 2026 | 6,521,600 | 1027 / 1334 / 1342 |

*(Legacy Elo figures come from 96 games per level against Stockfish 1320 at $\pm 65$ margin using the old browser planner settings, so they are not directly comparable to DROSO-1's PUCT-64 rating probe. In a direct 64-game held-out match with both models running PUCT 64, DROSO-1 defeated `fly-v6` 37–10–17.)*

### Legacy Export Format

| File | Contents |
| :--- | :--- |
| `weights.bin.gz` | Quantised parameters: int8 synapse gains, fp16 neuron biases and sensory weights, and per-row int8 readout matrices. |
| `model.json` | Training step metadata and SHA-256 checksums for weights and connectome. |
| `parity.json` | PyTorch reference outputs on six test positions. |
