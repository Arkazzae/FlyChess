# DROSO-1 Python Training Pipeline

This directory contains the Python code for preparing datasets, training **DROSO-1** on the FlyWire v783 connectome, running Stockfish evaluations, and exporting checkpoints to standalone and browser formats.

---

## Directory Structure

| Path | Role |
| :--- | :--- |
| **`droso1/`** | DROSO-1 model definition (`model.py`), losses (`loss.py`), data preparation (`prepare.py`, `reindex.py`, `audit.py`), trainer (`train.py`), Stockfish evaluation (`evaluate.py`, `harmonize.py`, `rating_match.py`), and exporters (`export.py`, `export_browser.py`, `bundle.py`). |
| **`core/`** | Shared 15-channel/22-global board encoder (`encoding.py`), 64-square visual column mapping (`input_map.py`), PUCT tree search (`puct.py`), and batched player wrapper (`player.py`). |
| **Top-level `.py`** | Sparse CSR connectome dynamics and custom CUDA/ROCm autograd kernel (`model.py`), base board utilities (`flychess.py`), checkpoint persistence (`training_state.py`), Stockfish self-play generator (`generate.py`), and Lichess importer (`import_lichess.py`). |

---

## Quick Start & Tests

From the repository root, create a Python 3.12 virtual environment and run the unit test suite:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r training/requirements.txt

cd training
python -m unittest discover -s droso1 -t . -p 'test_*.py'
python -m unittest test_training_state
```

### Hardware & External Tools

- **CPU-compatible commands:** Unit tests, data preparation (`prepare`, `reindex`, `audit`), rating summary recomputation (`rating_summary`), standalone CPU inference (`droso1.bundle --device cpu`), and browser asset export (`droso1.export_browser`).
- **CUDA-required commands:** Full-graph training (`droso1.train`), DAgger mistake collection (`droso1.collect`), model evaluation (`droso1.evaluate`), live rating matches (`droso1.rating_match`), and full standalone bundle export (`droso1.export`).
- **Stockfish 19:** Required by `generate.py`, `droso1.collect`, `droso1.evaluate`, `droso1.harmonize`, and `droso1.rating_match` via the `STOCKFISH_EXECUTABLE` environment variable.

---

## Documentation Links

- **[Training Recipe](../docs/droso-1/recipe.md):** Complete commands for corpus generation, training, evaluation, and browser export.
- **[Research Notes](../docs/droso-1/research.md):** Architecture changes, the A/B supervision experiment, and diagnostic findings.
- **[Benchmarks](../benchmarks/droso-1/README.md):** Stockfish 19 rating probe (~1500 Elo), `fly-v6` match PGNs, and move-quality reports.
- **[Pretrained Bundle (`artifacts/droso-1/`)](../artifacts/droso-1/README.md):** Ready-to-run weights and inference script.
