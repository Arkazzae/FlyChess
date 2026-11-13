![FlyChess: play chess against the brain of a fruit fly](docs/media/banner-illustrated.png)

# FlyChess

**FlyChess** lets you play chess against **DROSO-1**—a neural network built directly on the physical wiring diagram of a female fruit fly's brain (*Drosophila melanogaster*), reconstructed cell by cell under an electron microscope by the [FlyWire Consortium](https://flywire.ai).

The model runs on **134,181 neurons** connected by **2,700,513 directed pathways** (representing 34.2 million measured synapses). Who connects to whom, how many synapses link each pair, and whether a neuron is excitatory or inhibitory come straight from the biological connectome and never change. We attached a visual encoder to the fly's optic lobes, a motor readout to its descending pathways, and trained the synaptic gains and readout weights on 26 million chess positions analysed by Stockfish.

The entire brain (~51 MB compressed) downloads once and runs locally in your browser via WebGPU (with a CPU fallback)—no backend, no accounts.

<img src="docs/media/gameplay.gif" width="800" alt="A game against the Thinker fly: candidate moves appear as arrows on the board while Stockfish's evaluation bar tracks the position">

---

## Play in the Browser

**[fly-chess-thinker.vercel.app](https://fly-chess-thinker.vercel.app/)** — choose an opponent, pick a colour, and press **Play**.

### The Fly Personas (DROSO-1)

All four fly opponents run the exact same trained connectome checkpoint. They differ only in how many positions they evaluate via PUCT tree search before committing to a move:

| Persona | Search Budget | Style & Notes |
| :--- | :--- | :--- |
| **Scout** | 8 simulations | Fast, intuitive play driven mostly by the connectome's raw policy instinct. |
| **Tactician** | 32 simulations | Checks immediate replies and basic tactical sequences. |
| **Thinker** *(Default)* | 64 simulations | Full benchmarked setting. Scored **~1500 Elo** (95% CI: 1410–1603) against depth-limited Stockfish 19 ([benchmark details](benchmarks/droso-1/README.md)). |
| **Sage** *(Experimental)* | 1 – 256 simulations | Dynamically decides when to stop searching: plays obvious moves after a single pass and thinks up to 256 evaluations when torn. |

### Other Opponents & Modes

- **Bug personalities (Stockfish-backed):** If you want a different flavour of opponent, three non-connectome characters choose among Stockfish's top lines using custom heuristics: **Marvin** (a beginner beetle who loves captures and occasionally hangs pieces), **Nelsen** (a wasp obsessed with early queen attacks), and **Mitzi** (a polite ladybug in knitted mittens who plays near-optimal depth-14 lines).
- **Configurable Stockfish:** Play the bundled WebAssembly Stockfish engine directly at any skill level (0–20), search depth, and move time.
- **Bot vs. Bot:** Pair any two bots—including the fly against itself—and watch them play. When a fly is at the board, you can pause at any move and inspect its neural activity (or compare both brains side by side in a mirror match).

---

## Watch the Connectome Think

Every time the fly evaluates the board, the position is injected into its optic lobes and non-visual sensory neurons. Activity propagates across the recurrent connectome for **10 discrete time steps** before the readout layer decodes a move preference and position evaluation.

Switching to the **Fly Brain** tab (or full-screen brain view) replays that 10-step wave on the actual anatomy:

- **3D Point Cloud (WebGL):** Displays **117,708 neurons** at their measured cell-body (*soma*) coordinates from FlyWire, colour-coded across six anatomical divisions (visual circuits, visual projections, central brain, motor output, ascending pathways, and other senses).
- **Inter-Region Flow:** Tracks excitatory (green) and inhibitory (red) signal traffic between brain regions at each tick of the propagation wave.
- **Fly Retina & Candidate Thoughts:** Shows the 15-channel board representation feeding into the 22,586 visual neurons alongside the PUCT search tree's top candidate lines.

<img src="docs/media/brain.gif" width="800" alt="3D visualization of simulated neural activity spreading across 117,708 positioned neurons in the FlyWire connectome">

---

## Wait—How Much of the Fly Is Actually Left?

If you take a biological wiring diagram, bolt input and output layers onto it, and train it with PyTorch, AdamW, and backpropagation on 26 million chess positions, a fair question comes up immediately:

> **Is this still a fruit fly's brain, or is it just an ordinary neural network wearing a fly costume?**

It is a bit of a neural Ship of Theseus. Looking at the actual tensors inside [`artifacts/droso-1/weights.npz`](artifacts/droso-1/README.md) gives a surprisingly concrete answer.

### 1. What is 100% *Drosophila melanogaster*

- **The 99.985% sparse wiring topology:** A fully connected layer across 134,181 neurons would have **18.0 billion** weights. Evolution wired only **2,700,513** directed connections (with $\ge 5$ synapses)—just **0.015%** of all possible pairs. Backpropagation is never allowed to grow a new connection or prune an existing one. Every chess signal *must* enter through the optic lobes and sensory neurons, traverse the central brain over 10 recurrent steps, and reach the readout electrodes.
- **Dale's Law (excitatory vs. inhibitory identity):** In standard neural networks, any weight can flip from positive to negative during training. Here, each neuron's neurotransmitter sign is locked to its biological prediction in FlyWire: GABA and glutamate neurons inhibit ($-1$); acetylcholine, dopamine, serotonin, and octopamine neurons excite ($+1$). Because the learned edge multiplier $\exp(g_e)$ is strictly positive, **gradient descent can never turn an inhibitory synapse into an excitatory one**.
- **Microscope synapse counts still dominate the recurrent weights:** A connection with 150 physical synapses starts 30× stronger than a connection with 5 synapses. Each edge has a trainable log-gain $g_e$, regularized toward zero ($10^{-3}\,\overline{g^2}$) with a small learning rate ($2\times 10^{-5}$). After 26 million positions:
  - **90% of all 2.7 million connections** (5th to 95th percentile) have a multiplier $\exp(g_e)$ between **0.98× and 1.02×**—within $\pm 2\%$ of their raw anatomical synapse count.
  - Across the entire connectome, the most suppressed edge is scaled by **0.37×** and the most amplified edge by **2.22×**.
  - Training did not overwrite the fly's synaptic weights; it nudged them.

### 2. Where the Artificial Network Takes Over

A fruit fly evolved to dodge swatters, navigate airflow, and find fermenting fruit—not to play the Ruy Lopez. Making the connectome play chess required three major departures from biology:

- **Rate dynamics instead of spiking biophysics:** Real *Drosophila* neurons communicate through action potentials, graded potentials, and complex dendritic arbor computations with distinct receptor time constants. DROSO-1 models each neuron as a leaky saturating rate unit (`drive / (1 + drive)`) running for 10 discrete steps, trained via Backpropagation Through Time (BPTT) over the final 4 steps.
- **Prosthetic sensory and motor adapters:** Hexagonal ommatidia in a compound eye do not naturally see rooks or en passant flags, and descending motor neurons are wired to drive wings and six legs, not a 4,168-move chess action space. Linear projections translate the 64-square board into sensory currents, and a 2-layer 512-unit MLP decodes neural activity from 7,526 readout electrodes into move probabilities and centipawn evaluations.
- **The 30 / 70 parameter split:** If you count every parameter active during a game (**9,551,183** in total, excluding the training-only reply head), the division between biological modulation and artificial adapters looks like this:

| Component | Trainable Parameters | Share of Active Model | Role |
| :--- | ---: | ---: | :--- |
| **Connectome gains & biases** | **2,834,694** | **29.7%** | 2,700,513 per-edge log-gains + 134,181 neuron biases inside the fly graph |
| **Sensory interface** | **446,260** | **4.7%** | Projects 64×15 board channels $\to$ 22,586 optic neurons & 22 globals $\to$ 4,885 sensory neurons |
| **Readout MLP trunk** | **4,131,532** | **43.3%** | Reads 7,526 electrodes $\to$ BatchNorm $\to$ 512 $\to$ 512 (Quick-GELU residual) |
| **Policy & value heads** | **2,138,697** | **22.4%** | Maps the 512-dim readout state to 4,168 moves + position value |

Roughly **30% of the trainable parameters live inside the biological connectome**, while **70% live in the sensory/motor prosthetics** bolted onto its ends.

### 3. Learned Circuit or Biological Reservoir?

That parameter split raises the most interesting question of all: *is the fly's brain actively computing chess tactics, or is it acting as a giant recurrent reservoir—a biological [Liquid State Machine](https://en.wikipedia.org/wiki/Liquid_state_machine)—that projects the board into a high-dimensional space for the 512-unit readout MLP to untangle?*

In practice, it is a hybrid of both:
1. The connectome is not a passive, frozen reservoir: gradient descent actively modified **1,780,206** of the 2,700,513 biological connections, tuning the recurrent pathways so useful board features survive 10 hops from the optic lobes to the descending neurons.
2. At the same time, the 2-layer readout MLP carries significant representational capacity of its own, reading directly from 7,526 electrodes distributed across the motor output, central brain, visual projections, and deep optic lobe.

Without a controlled ablation—such as freezing all connectome gains at $g_e = 0$ or rewiring the 2.7 million edges randomly while keeping the readout identical—you cannot claim that evolution secretly wired *Drosophila* for chess. **Anatomically, your opponent is a real fruit fly's connectome; mathematically, it is a cyborg.**

---

## Documentation & Repository Guide

Everything needed to run the web app, run standalone Python inference, inspect the benchmark games, or train a new model from scratch is included in this repository:

| Document | Contents |
| :--- | :--- |
| **[How DROSO-1 Works](docs/how-it-works.md)** | End-to-end technical architecture: board encoding, 64-square visual mapping, 10-step rate dynamics, readout MLP, PUCT search, and browser WebGPU execution. |
| **[Training Overview](docs/training.md)** | High-level summary of the training pipeline, supervision targets, and entry points. |
| **[Training Recipe](docs/droso-1/recipe.md)** | Step-by-step commands to build a corpus (Lichess + Stockfish self-play + DAgger mistakes), run the trainer, evaluate checkpoints, and export to the browser. |
| **[Research Notes](docs/droso-1/research.md)** | Controlled A/B supervision experiment, comparison against the earlier `fly-v6` prototype, diagnostic findings, and experimental limitations. |
| **[Benchmarks & PGNs](benchmarks/droso-1/README.md)** | Full breakdown of the ~1500 Elo Stockfish 19 probe, the 64-game match vs. `fly-v6` (37–10–17), and 512-position move-quality audits. |
| **[Pretrained Python Bundle](artifacts/droso-1/README.md)** | Self-contained inference package (`artifacts/droso-1/`) with lossless FP32 weights, connectome graph, and verification scripts. |
| **[Development Guide](docs/development.md)** | Local dev server, Playwright browser & WebGPU parity tests, directory layout, and media capture scripts. |
| **[Data & Licences](docs/data.md)** | Provenance, citations, and licences for FlyWire v783, legacy MaleCNS v1.0, Lichess evaluations, and Stockfish. |

## Licences

- **Code & trained weights:** [MIT](LICENSE) (original training/inference port notice in [`training/LICENSE`](training/LICENSE)).
- **Connectome data:** [FlyWire FAFB v783](https://zenodo.org/records/10676866) and [MaleCNS v1.0](https://male-cns.janelia.org/download/) (used in [legacy prototypes](artifacts/legacy/)), both under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Chess engine:** Bundled `stockfish.js` (evaluation bar, post-game review, and non-fly opponents) is licensed under **GPL-3.0**.
