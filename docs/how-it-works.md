# How DROSO-1 plays

DROSO-1 uses the fixed FlyWire v783 graph of a female fruit fly's brain. Every
retained directed connection has at least five measured synapses. Training
changes gains, biases, sensory inputs and readout weights; it does not add or
remove connections.

| Anatomy | Count |
| --- | ---: |
| Neurons | 134,181 |
| Directed connections | 2,700,513 |
| Measured synapses | 34,153,566 |
| Neurons with a measured cell-body position | 117,708 |
| Visual input neurons | 22,586 |
| Global input neurons | 4,885 |
| Readout neurons | 7,526 |

The graph groups neurons into optic circuits, visual projections, central
brain, descending pathways, ascending pathways and other senses. Predicted
GABA and glutamate neurons are modelled as inhibitory; other or unknown
transmitters are excitatory. This is a modelling assumption, not a simulation
of individual receptors or a living animal.

## From board to activity

The encoder always faces the side to move. Black positions are mirrored
vertically with colours swapped. All 64 squares have visual inputs.

Each square has **15 channels**: six own piece types, six opposing types,
both attack maps and the legal en passant target. **22 global features**
represent castling rights, check, legal en passant, material, phase, halfmove
clock, a constant input and two knowledge flags. Unknown clocks are masked until a pawn move or
capture establishes the count. The history input is always false, matching
the trained search adapter; repetition history is handled by the chess rules.

Every evaluation starts from rest and runs ten steps:

```text
drive_i = relu(κ · Σ activity_src · sign_src · synapses_e · exp(gain_e)
               / total_synapses_i + bias_i + board_input_i)
activity_i ← (1 − α) · activity_i + α · drive_i / (1 + drive_i)
α = 0.65; κ = 0.95
```

A readout of 7,526 neurons feeds two 512-unit layers with a residual connection.
The **4,168-action policy** represents normal moves and queen promotions with
from/to indices, plus 72 dedicated knight, bishop and rook promotion actions.
Legal-move masking prevents illegal moves. Search uses the policy and the
current position value, `tanh(centipawns / 600)`. The network also has
reply, future-value and outcome outputs; they are kept so the browser matches
the Python checkpoint, but neither search nor the interface uses them. The
replies shown in the interface come from the search tree.

## Search

All four opponents use the same checkpoint and PUCT algorithm with exploration
constant 1.5. Scout gets **8 simulations**, Tactician **32**, and Thinker **64**,
including the root evaluation and visits to terminal positions. Sage gets up to
**256** and decides how many it needs (see below). Search stops
early if it proves the root's result; otherwise untimed games finish that
budget, while timed games may stop earlier. Policy priors guide exploration,
and values from visited positions determine which continuations deserve more
visits.

All legal moves enter the tree, including underpromotions. Proved mates take
precedence over neural scores. Checkmate, stalemate, insufficient material,
threefold claims and fifty-move claims use exact rules. A second occurrence
alone is not scored as a draw. The final choice favours visit count, then prior;
there is no opening-book or Stockfish move fallback.

### Sage: an adaptive budget

Sage treats 256 simulations as a ceiling. It checks after the root evaluation
and then every 8 simulations, and stops as soon as one of these holds:

- only one move is playable, or the policy gives one move at least 90%
  (it moves after a single evaluation);
- the most-visited move leads the runner-up by more visits than remain;
- that lead is at least 2·√n visits (n = visits so far) and the leader's value
  is at least the runner-up's;
- after 64 simulations, the two leading moves' values are within 0.02
  (about 12 centipawns), so the choice between them hardly matters.

Otherwise it keeps searching. On about 110 positions from three benchmark games
it used 64.8 simulations on average, about as many as Thinker, spread from 1 to
256. The
adaptive stop is a browser play setting; the Python player in `training/` and
`artifacts/` has no equivalent and always completes its budget.

When the fly plays in a **Bot vs bot** match (against itself or another bot),
each fly uses the search budget picked for its side. Its first eight
half-moves are sampled in proportion to visit count (temperature 1), so only
moves the search visited can be played and no two games are the same. After
that, and in every game against a player, the choice is the deterministic one
above.

## The other opponents

The other opponents do not use the connectome. They run on the bundled
Stockfish build (`src/ai/stockfish-player.ts`), a 2019 multi-variant
Stockfish with Skill Level 0–20 but no Elo option:

- **Stockfish** plays with the player's skill level, maximum depth and time
  per move. With a game clock it spends at most about a 35th of its remaining
  time on a move (never less than 0.1 s).
- **Marvin**, **Nelsen** and **Mitzi** ask Stockfish (at full skill) for its
  best few lines, then choose among them with a softmax over centipawns plus
  their own taste (`src/ai/persona.ts`). Marvin looks 3 plies deep at 10
  lines, chooses loosely, loves captures and plays any legal move one time in
  four. Nelsen looks 6 plies deep and adds a bonus to queen moves that fades
  over the first 24 half-moves; when no queen move is among Stockfish's lines,
  he searches the queen moves separately. Mitzi takes one of the three best
  lines at depth 14, almost always the first.

Their strength labels describe the style. None of them has been rated.

## Browser and brain view

The browser downloads about **51.3 MB** of compressed graph and FP32 weights,
verifies SHA-256 and transfers them to a worker. FP32 weights avoid int8/float16
quantisation of this release. Batch normalisation is folded into scale/shift.
WebGPU runs the ten propagation steps when available, with CPU fallback.
Tests compare browser inference with the original PyTorch outputs and WebGPU
with the CPU path.

Before search, a separate CPU recording captures the current board's activity at
rest and after each of ten steps, plus excitatory and inhibitory flow between
regions. The cloud and flow diagram replay this recording. The dots use measured
soma coordinates from the pinned FlyWire annotation release; neurons with no
recorded soma are hidden, but remain part of the model. The view is a simulation
of activity on measured anatomy, not a recording from a fly.

Game review recomputes this propagation for each displayed position. Saved
search thoughts are available for positions where the fly chose a move during
the game; reviewing a human move does not create a new search record.

See the [recipe](droso-1/recipe.md), [research](droso-1/research.md),
[benchmarks](../benchmarks/droso-1/README.md) and [data provenance](data.md).
