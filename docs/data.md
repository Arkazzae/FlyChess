# Data Provenance & Licences

Application code and trained model weights are released under the repository **[MIT Licence](../LICENSE)** (with the original training/inference port notice retained in [`training/LICENSE`](../training/LICENSE)). External connectome datasets, evaluation corpora, and chess engines keep their respective upstream licences as detailed below.

---

## 1. FlyWire FAFB v783 Connectome (DROSO-1)

- **Files:** `artifacts/droso-1/graph.npz` (Python bundle) and `public/data/flywire/connectome.bin.gz` (browser export).
- **Upstream Source:** FlyWire Consortium, [FAFB v783 connectivity release](https://zenodo.org/records/10676866), licensed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.
- **Graph Construction:** Retains all directed edges with $\ge 5$ measured synapses (2,700,513 edges across 134,181 neurons, summing to 34,153,566 synapses) and preserves full 64-bit FlyWire root IDs. Neurotransmitter sign assignments (GABA and glutamate inhibitory; other/unknown excitatory), the six regional groupings, and the mapping from optic-lobe columns to the 64 chess squares are model abstractions built on the anatomical data.
- **3D Soma Coordinates:** Cell-body coordinates (`soma_x/y/z`) come from [FlyWire neuron annotations v2.1.0](https://github.com/flyconnectome/flywire_annotations/tree/v2.1.0) ([4 × 4 × 40 nm voxel units](https://fafbseg-py.readthedocs.io/en/stable/_modules/fafbseg/flywire/annotations.html)). The browser exporter converts these to physical nanometres, centres and normalizes them into `[-1, 1]`, and permutes axes so the dorsal side faces up. The **117,708 neurons** with measured somata are rendered in the 3D point cloud; the remaining 16,473 neurons without recorded soma coordinates remain active in the simulation but are not drawn.
- **Provenance Manifests:** Exact upstream URLs, SHA-256 hashes, DOIs, and transformation parameters are pinned in [`artifacts/droso-1/graph-provenance.json`](../artifacts/droso-1/graph-provenance.json) and [`public/data/flywire/manifest.json`](../public/data/flywire/manifest.json). *(Note: `covered_squares: 50` in `graph-provenance.json` describes the raw hexagonal column projection before `complete_square_map` remaps visual neurons across all 64 squares at model initialization.)*

---

## 2. Legacy MaleCNS v1.0 Connectome (`fly-v6` & `fly-v4`)

- **File:** `artifacts/legacy/mcns/connectome.bin.gz`.
- **Upstream Source:** [MaleCNS v1.0](https://male-cns.janelia.org/download/) by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.
- **Graph Summary:** Traced-only, $\ge 5$-synapse graph containing 163,903 neurons and 6,235,682 directed connections. Retained for historical reference with the [`fly-v6`](../artifacts/legacy/fly-v6/README.md) and [`fly-v4`](../artifacts/legacy/fly-v4/README.md) prototypes; not loaded by the web application. Full attribution and hashes are recorded in [`artifacts/legacy/mcns/manifest.json`](../artifacts/legacy/mcns/manifest.json).

---

## 3. Training & Benchmark Corpora

- **Lichess Evaluations:** Imported from the public [Lichess evaluation database](https://database.lichess.org/#evals), released under **CC0**.
- **Generated & DAgger Shards:** Labelled with Stockfish 19. The raw 10.26M-position training shards are not bundled in git; held-out evaluation splits (`dev`, `validation`, `test`), match openings, PGNs, and regret reports are archived in [`benchmarks/droso-1/`](../benchmarks/droso-1/README.md).

---

## 4. Stockfish

- **Browser Runtime (`public/stockfish.js`):** WebAssembly build by [Niklas Fiekas (`stockfish.js`)](https://github.com/lichess-org/stockfish.js), licensed under **GPL-3.0**. Runs in dedicated Web Workers to power the evaluation bar, post-game move review, and the four non-fly opponents (`Stockfish`, `Marvin`, `Nelsen`, and `Mitzi`). It never participates in selecting DROSO-1's moves.
- **Native Engine (`STOCKFISH_EXECUTABLE`):** A separate native Stockfish 19 binary is used offline by the Python data-collection and benchmark scripts in `training/`.

---

## 5. Illustrations & Portraits

The README banner (`docs/media/banner-illustrated.png`), favicon (`public/`), fly persona portraits (`public/avatars/flies/`), and Stockfish-backed character portraits (`public/avatars/bots/`) are original illustrations created for FlyChess.
