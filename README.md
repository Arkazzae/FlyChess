![FlyChess: play chess against the brain of a fruit fly](docs/media/banner-illustrated.png)

# FlyChess

**FlyChess** lets you play chess against the brain of a fruit fly.

Scientists at the [FlyWire Consortium](https://flywire.ai) sliced a real female fruit fly's brain under an electron microscope and mapped every single cell—**134,181 neurons** and **2.7 million connections** between them. We took that exact wiring diagram, hooked a chessboard up to the neurons in the fly's eyes, connected move decisions to the neurons that would normally steer its body, and taught it to play chess by studying 26 million positions analysed by Stockfish.

The whole brain (about 51 MB) downloads once and runs directly in your browser—no account, no server, and works on phones too.

<img src="docs/media/gameplay.gif" width="800" alt="A game against the Thinker fly: candidate moves appear as arrows on the board while Stockfish's evaluation bar tracks the position">

---

## Play

**[fly-chess-thinker.vercel.app](https://fly-chess-thinker.vercel.app/)** — pick an opponent, choose White or Black, and press **Play**.

### The Flies

All four flies share the exact same brain (**DROSO-1**). The only difference is how long they stop to think before making a move:

- **Scout** *(Quick)* — Glances at **8 positions** before moving. Plays mostly on gut instinct.
- **Tactician** *(Balanced)* — Looks ahead **32 positions** to check your immediate replies.
- **Thinker** *(Default · ~1500 Elo)* — Evaluates **64 positions** per move. This is the only fly we rated in a full benchmark: it scored about **1500 Elo** across 64 games against a weakened Stockfish 19 ([see the benchmark](benchmarks/droso-1/README.md)).
- **Sage** *(Experimental)* — Decides for itself how long to think: moves immediately when a choice is obvious, and checks up to **256 positions** when it's torn. (Tucked under the *Experimental* tab because its search can occasionally take a while or play an odd move.)

### Other Bugs & Modes

- **Three Stockfish-powered characters:** If you want a break from the fly, three other insects pick from Stockfish's ideas in their own style—**Marvin** (a beginner beetle who grabs everything and hangs pieces), **Nelsen** (a wasp who brings his queen out early), and **Mitzi** (a polite ladybug in knitted mittens who rarely misses a tactic).
- **Custom Stockfish:** Play the classic Stockfish engine directly at whatever skill level, search depth, and time limit you prefer.
- **Bot vs. Bot:** Pair any two bots—including the fly against itself—and watch them play. Pause anytime to inspect the board or peek inside the brain.

---

## Watch the Brain Work

Before every move, the chessboard is sent to the fly's visual neurons. A wave of activity travels from its eyes through the centre of its brain over **10 steps**, and the move is read out at the end.

Open the **Fly Brain** tab during any game to watch that wave happen live:

- **3D Brain View:** Shows **117,708 neurons** at their real measured positions inside the fly's head, lighting up as the signal spreads from the eyes to the central brain and motor outputs.
- **Region Flow:** Shows which parts of the brain are exciting each other (green) or acting as brakes (red) at each step.
- **What the Fly Sees & Thinks:** Displays the board as the fly's eyes receive it alongside the candidate moves it is weighing.

<img src="docs/media/brain.gif" width="800" alt="3D visualization of simulated neural activity spreading across 117,708 positioned neurons in the FlyWire connectome">

---

## Wait—How Much of the Fly Is Actually Left?

If you take a fly's brain map and train it on a computer like any other AI neural network, an obvious question comes up:

> **Is there still a fruit fly in there, or is it just a normal AI wearing a fly costume?**

It's a classic "Ship of Theseus" puzzle. Here is the honest breakdown of what stays real biology and what is artificial AI:

### 1. The wiring map is 100% real fly
Imagine a city's road network. In a standard AI network, every neuron can connect to every other neuron—which for 134,181 neurons would mean **18 billion connections**. In the real fruit fly, evolution built only **2.7 million one-way roads** (less than 0.02% of all possible routes). During training, our AI is **never allowed to build a new road or demolish an existing one**. Every single signal from the chessboard has to travel down the exact pathways the real fly grew.

### 2. Brakes stay brakes, gas stays gas
In a living brain, some neurons push signals forward (excitatory) and others act like brakes (inhibitory), depending on their chemistry. Those roles come straight from the fly data and are locked: training can make a connection slightly stronger or weaker, but it **can never turn a brake into a gas pedal**.

### 3. Training nudged the brain instead of overwriting it
Under the microscope, some connections between neurons are thick highways (hundreds of synapses) and others are tiny footpaths (just five). Training didn't wipe that out—in fact, **90% of the fly's 2.7 million connections changed by less than 2%** from their original microscope measurements.

### 4. The "cyborg" adapters on both ends
Of course, a real fruit fly evolved to dodge swatters and find overripe bananas—not to spot knight forks. Its eyes don't naturally know what a rook is, and its leg muscles don't know how to play `e2–e4`.

To bridge that gap, we had to bolt two artificial translators onto the brain:
- **A pair of "chess glasses" on the front** that translates the 64 squares of the board into signals for the fly's visual neurons.
- **A "move translator" on the back** that reads the brain's final activity and turns it into legal chess moves.

If you count all the settings tuned during training, about **30% live inside the fly's brain itself**, and **70% live in those front-and-back translators**.

### So... is the fly actually thinking?
That 30 / 70 split leaves a fun scientific question: *is the fly's brain actively calculating chess, or is it acting like a giant biological echo chamber that scrambles the board into a rich pattern for the translator at the end to read?*

In practice, it's a bit of both. Training actively tuned **1.78 million** of the fly's 2.7 million internal connections, so the brain is doing real work to pass useful signals from its eyes to its outputs—not just sitting idle. **Anatomically, your opponent is a real fruit fly; mathematically, it's a cyborg.**

*(Want the exact parameter counts, equations, and technical details? See [Anatomy vs. Adapters in `docs/how-it-works.md`](docs/how-it-works.md#8-anatomy-vs-adapters-how-much-of-the-model-is-the-fly).)*

---

## Under the Hood

Everything needed to run the model, inspect the benchmarks, or train your own fly brain from scratch is in this repository:

- **[How DROSO-1 Works](docs/how-it-works.md)** — Full technical architecture: board encoding, 10-step brain dynamics, tree search, and the exact parameter breakdown.
- **[Training Overview](docs/training.md)** & **[Step-by-Step Recipe](docs/droso-1/recipe.md)** — How the model was trained on 26 million positions and how to reproduce it.
- **[Research Notes](docs/droso-1/research.md)** — Experiments, comparisons with earlier prototypes (`fly-v6`), and limitations.
- **[Benchmarks & Game PGNs](benchmarks/droso-1/README.md)** — How the ~1500 Elo rating was measured, plus downloadable games.
- **[Pretrained Python Model](artifacts/droso-1/README.md)** — Run the trained brain standalone in Python on CPU or GPU.
- **[Development Guide](docs/development.md)** — Run the website locally and execute the browser tests.
- **[Data & Licences](docs/data.md)** — Sources and citations for the FlyWire connectome, Lichess data, and Stockfish.

**Licences:** Code and model weights are [MIT](LICENSE). Connectome data is from FlyWire v783 (and MaleCNS v1.0 for the [legacy prototypes](artifacts/legacy/)), both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The evaluation bar, game review, and non-fly bots use Stockfish (GPL-3.0).
