# How DROSO-1 Works

**DROSO-1** is a chess engine built around the fixed electron-microscope connectome of a female fruit fly (*Drosophila melanogaster*, [FlyWire FAFB v783](https://zenodo.org/records/10676866)). Every move evaluation converts the chessboard into sensory currents, propagates activity through 134,181 neurons for 10 recurrent steps, reads out a move policy and position value from 7,526 electrodes, and guides a PUCT tree search.

```text
Chess Position (side-to-move frame)
 ├── 64 squares × 15 channels ──► 22,586 Optic-Lobe Neurons ──┐
 └── 22 global game features  ──►  4,885 Sensory Neurons    ──┼──► 10-Step Recurrent Connectome
                                                              │    (134,181 neurons · 2,700,513 edges)
                                                              └──► 7,526 Readout Electrodes
                                                                    └──► BatchNorm → 512 → 512 MLP
                                                                          ├──► 4,168-Move Policy
                                                                          └──► Position Value tanh(CP/600)
                                                                                └──► PUCT Tree Search
```

---

## 1. The Connectome Graph

The recurrent core is derived from FlyWire connectivity release 783, retaining all directed neuron-to-neuron connections with **at least 5 measured synapses** and every neuron incident to those edges.

| Anatomical Property | Count | Details |
| :--- | ---: | :--- |
| **Neurons ($N$)** | 134,181 | Grouped into 6 functional divisions |
| **Directed connections ($M$)** | 2,700,513 | Edges with $\ge 5$ synapses (0.015% graph density) |
| **Total synapses** | 34,153,566 | Sum of measured synapse counts across retained edges |
| **Positioned somata** | 117,708 | Neurons with 3D cell-body coordinates for the WebGL viewer |

### Anatomical Regions & Roles

Each neuron belongs to one of six anatomical groups:

| Group ID | Region | Neurons | Role in DROSO-1 |
| :---: | :--- | ---: | :--- |
| **0** | **Visual circuits** (optic lobes) | 84,993 | **22,586** column-assigned cells (`L1–L5`, `Mi1/4/9`, `C2/3`, `T1`, `Tm1/2/4/9/20`) receive per-square inputs; **62,407** deep optic neurons process visual activity and contribute **2,048** readout electrodes. |
| **1** | **Visual projections** | 8,565 | Relay signals from the optic lobes to the central brain; **2,048** sampled as readout electrodes. |
| **2** | **Central brain** | 32,367 | Associative and recurrent integration centres; **2,048** sampled as readout electrodes. |
| **3** | **Descending & motor output** | 1,382 | Output pathways that drive the insect's body; **all 1,382** serve as readout electrodes. |
| **4** | **Ascending pathways** | 1,989 | Relay signals upward into the central brain. |
| **5** | **Other senses** | 4,885 | Non-visual sensory neurons; **all 4,885** receive the 22 global board features. |

### Neurotransmitter Signs (Dale's Law)

Every neuron has a fixed sign $s_j \in \{+1, -1\}$ based on its predicted neurotransmitter in FlyWire:
- **Inhibitory ($-1$, 42,544 neurons):** Glutamate (23,775) and GABA (18,769).
- **Excitatory ($+1$, 91,637 neurons):** Acetylcholine (83,847), dopamine (5,848), serotonin (1,781), octopamine (113), and 48 unlabelled neurons.

---

## 2. Sensory Encoding: From Board to Neural Input

The board is always encoded from the **perspective of the side to move** (when Black is to move, ranks are mirrored vertically and piece colours are swapped).

### Visual Input (64 Squares × 15 Channels $\to$ 22,586 Neurons)

Earlier prototypes scaled the fly eye's oblique hexagonal lattice (`hex1`, `hex2`) linearly onto a rectangle, leaving 14 corner squares without visual neurons. DROSO-1 replaces that with `complete_square_map` ([`training/core/input_map.py`](../training/core/input_map.py)), which partitions all measured optic-lobe columns into 8 spatial rank bands and 8 file groups per band so **every one of the 64 squares** drives visual neurons directly.

Each square provides **15 binary/scalar channels**:
- **6 own piece planes:** Pawn, knight, bishop, rook, queen, king.
- **6 opponent piece planes:** Pawn, knight, bishop, rook, queen, king.
- **2 attack maps:** Squares attacked by the mover and by the opponent.
- **1 legal en passant target:** Marks the capture square when an en passant capture is strictly legal.

Each visual neuron $i$ mapped to square $q(i)$ computes its sensory current via a learned 15-element weight vector $w^{\text{vis}}_i$:

$$\text{input}_i = \langle \text{square}_{q(i)},\, w^{\text{vis}}_i \rangle$$

### Global Input (22 Features $\to$ 4,885 Neurons)

The 4,885 non-visual sensory neurons (Group 5) receive a linear projection of **22 board-wide features**:
- Castling rights (4), check indicator (1), legal en passant indicator (1), game phase and piece-count/material balance features, normalized halfmove clock, a constant bias channel, and two metadata flags (`halfmove_known` and `history_known`).
- When a position is imported from a bare FEN without move history, the unknown halfmove clock is masked until a pawn move or capture resets it. The `history_known` input channel is held `false` to match the trained search adapter; actual threefold-repetition and 50-move draw rules are enforced exactly by the search tree.

---

## 3. Recurrent Connectome Dynamics

Each position evaluation starts from a resting brain ($a_i^{(0)} = 0$) and runs **10 discrete recurrent time steps** ($t = 1 \dots 10$).

For each directed connection $e = (j \to i)$ with anatomical synapse count $c_e \ge 5$, training learns a scalar log-gain $g_e$ (initialized at $0$). Incoming current to neuron $i$ is normalized by its total anatomical input synapse count $C_i = \sum_{e \in \text{in}(i)} c_e$:

$$\text{drive}_i^{(t)} = \operatorname{ReLU}\!\left( \frac{\kappa}{C_i} \sum_{e=(j \to i)} a_j^{(t-1)} \, s_j \, c_e \, \exp(g_e) \;+\; b_i \;+\; \text{input}_i \right)$$

$$a_i^{(t)} = (1 - \alpha)\,a_i^{(t-1)} + \alpha\,\frac{\text{drive}_i^{(t)}}{1 + \text{drive}_i^{(t)}}$$

where:
- $\kappa = 0.95$ is the recurrent coupling scale,
- $\alpha = 0.65$ is the leaky integration rate,
- $b_i$ is a learned per-neuron bias, and
- $\frac{x}{1 + x}$ saturates firing rates smoothly into $[0, 1)$.

Because $\exp(g_e) > 0$, training can amplify or attenuate individual connections while preserving every neuron's excitatory or inhibitory sign $s_j$.

---

## 4. Readout MLP & Action Space

After step 10, the model reads final firing rates $a_i^{(10)}$ from **7,526 readout electrodes** (all 1,382 descending motor neurons plus 2,048 fixed-seed neurons each from the central brain, visual projections, and deep optic lobe).

Because raw connectome firing rates are small (mean $\approx 0.01$), each electrode is standardized by a `BatchNorm1d` layer (`feature_norm`, folded into scale/shift constants at export time) and passed through a two-layer **512-unit residual MLP** with Quick-GELU activations ($\phi(x) = x\,\sigma(1.702x)$):

$$h_1 = \phi(W_1\,\operatorname{BN}(a_{\text{readout}}) + b_1), \qquad h_2 = h_1 + \phi(W_2 h_1 + b_2)$$

Three linear heads project $h_2$:

1. **Move Policy (`4,168` logits):**
   - Indices `0..4095` (`from_square * 64 + to_square` in mover coordinates) cover all standard moves and queen promotions.
   - Indices `4096..4167` (`72` actions: 8 source files × 3 capture/push directions × 3 piece types) cover knight, bishop, and rook underpromotions.
   - Illegal moves are masked to $-\infty$ before softmax, so the engine never plays an illegal move.
2. **Value Head (`3` outputs):**
   - Output `0` predicts current position value $\tanh(\text{cp} / 600)$ from the side to move's perspective. This is the **only value output used during play**.
   - Outputs `1` (future CP at $+8$ plies) and `2` (game outcome) come from experimental Arm A and remain in the checkpoint tensor shape for compatibility, but are unused in Arm B and search.
3. **Opponent Reply Head (`4,168` logits):**
   - Auxiliary training head that predicts the opponent's reply; unused during play (the browser UI displays actual continuation lines from the PUCT search tree).

---

## 5. PUCT Search & Fly Personas

All four fly opponents run the same DROSO-1 checkpoint and PUCT algorithm ($c_{\text{puct}} = 1.5$), differing only in simulation budget:

| Persona | Simulations | Behaviour |
| :--- | ---: | :--- |
| **Scout** | 8 | Root evaluation + 7 tree expansions. |
| **Tactician** | 32 | Moderate tactical lookahead. |
| **Thinker** | 64 | Standard benchmarked strength (~1500 conditional Elo). |
| **Sage** *(Experimental)* | 1 – 256 | Adaptive stopping rule (see below). |

### Search Rules

- Every simulation expands a leaf node using the masked policy priors and backs up the neural value $\tanh(\text{cp} / 600)$ (or exact $-1 / 0 / +1$ on terminal nodes).
- Checkmate, stalemate, insufficient material, fifty-move claims, and threefold repetition claims are scored with exact chess rules. A two-fold repetition is not treated as a draw prematurely.
- Proved mates override neural scores. Move selection picks the child with the highest visit count (breaking ties by policy prior), with no opening book or external engine fallback.
- **Bot vs. Bot variety:** When a fly plays in a Bot-vs-Bot match, its first 8 half-moves are sampled proportionally to visit counts (temperature $1.0$) so repeated matches explore different games. Against a human player, move choice is always deterministic.

### Sage's Adaptive Budget (Experimental)

Sage treats 256 simulations as an upper bound, checking after the root evaluation and every 8 simulations thereafter. It stops early as soon as any of the following holds:
1. Only one legal move exists, or the root policy assigns $\ge 90\%$ probability to a single move (moves immediately after 1 evaluation).
2. The most-visited move leads the runner-up by more visits than remain in the 256-simulation ceiling.
3. The visit lead is at least $2\sqrt{n}$ ($n =$ total visits so far) **and** the leader's mean value is at least as high as the runner-up's.
4. At $\ge 64$ simulations, the top two moves have values within $0.02$ (~12 centipawns), meaning the choice between them is nearly indifferent.

Across ~110 positions from three benchmark games, Sage averaged **64.8 simulations per move** (matching Thinker's average budget while allocating between 1 and 256 evaluations depending on complexity). The adaptive controller is a browser-side feature (`src/ai/fly/planner.ts`); the standalone Python player always runs its fixed simulation count.

---

## 6. Stockfish-Powered Opponents

The four non-fly opponents do not use the connectome. They run on the bundled WebAssembly Stockfish build (`src/ai/stockfish-player.ts`, a multi-variant Stockfish with `Skill Level` 0–20):

- **Marvin (Beginner beetle):** Runs MultiPV 10 to depth 3, samples loosely across centipawn scores with a capture bonus, and plays a random legal move 25% of the time.
- **Nelsen (Queen-rusher wasp):** Runs depth 6 and adds a large bonus to queen moves during the first 24 half-moves; if Stockfish's top lines contain no queen moves, he runs a separate search restricted to queen moves.
- **Mitzi (Ladybug in mittens):** Searches the top 3 lines to depth 14 and almost always picks the best move.
- **Stockfish:** Exposes Skill Level (0–20), maximum depth, and per-move time directly to the player. In timed games, it budgets roughly $1/35$ of its remaining clock per move (minimum $0.1\text{ s}$).

---

## 7. Browser Runtime & 3D Brain Visualization

- **Zero-quantisation FP32 export:** The browser downloads `connectome.bin.gz` (~11 MB) and `weights.bin.gz` (~40 MB), verifies their SHA-256 checksums against `manifest.json` and `model.json`, and initializes the engine inside a Web Worker. Unlike earlier prototypes that used int8/fp16 quantisation, DROSO-1 ships lossless FP32 weights with folded BatchNorm parameters so browser outputs match PyTorch FP32 reference fixtures within numeric tolerance.
- **WebGPU acceleration:** When a compatible hardware adapter is available, the 10 sparse matrix-vector propagation steps run on the GPU via compute shaders (`src/ai/fly/gpu.ts`), falling back transparently to typed-array CPU loops (`src/ai/fly/brain.ts`).
- **Live neural recording:** Before each search, a dedicated CPU pass records 11 activity frames (resting frame 0 plus steps 1–10) across all 134,181 neurons, along with the $6\times 6$ excitatory and inhibitory synaptic flux between anatomical regions.
- **3D Point Cloud & Review:** The WebGL viewer (`src/brain/CloudView.ts`) plots the 117,708 neurons that have measured `soma_x/y/z` coordinates in FlyWire annotations v2.1.0 (the remaining 16,473 neurons without recorded soma coordinates still participate in the math, but are omitted from the 3D render rather than placed at fake coordinates). During post-game review, stepping through the move list recomputes the 10-step propagation live for any board position.
