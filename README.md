![FlyChess: play chess against the brain of a fruit fly](docs/media/banner-illustrated.png)

Ever lost at chess to an insect? Here's your chance.

Your opponent is the brain of a fruit fly. Not a cartoon of one: the real
wiring of a *Drosophila*, 134,181 neurons and 2.7 million connections, mapped
cell by cell under an electron microscope by [FlyWire](https://flywire.ai).
We kept that wiring fixed, trained the strength of its connections on
Stockfish's analysis, and put the whole thing in your browser.

<img src="docs/media/gameplay.gif" width="800" alt="A game against the Thinker fly: it weighs its candidate moves (arrows) while Stockfish's bar keeps score">

## Play

**[fly-chess-thinker.vercel.app](https://fly-chess-thinker.vercel.app/)**:
pick a fly, pick a colour, press **Play**.

- **Scout** looks at 8 positions before it moves, **Tactician** at 32,
  **Thinker** at 64. Same brain, different patience.
- **Fly vs fly** lets it play against itself. Pause whenever you like and look
  inside both brains.
- The first visit downloads the brain (about 51 MB). After that everything
  runs on your own computer, with no account and no backend. Phones work too;
  they just think a little slower.

## Watch it think

Every move sends a wave of activity from the fly's eyes through its brain, and
you can watch it happen: neurons lighting up in 3D, signals flowing between
brain regions, the moves it is weighing, and the board as its eyes see it.

<img src="docs/media/brain.gif" width="800" alt="Simulated activity in the fly's brain; the cloud shows 117,708 neurons with measured cell-body positions">

## Is it any good?

Better than you'd expect from something that tastes with its feet. The Thinker
scored about **1500** in 64 games against a deliberately weakened Stockfish 19
([how we tested](benchmarks/droso-1/README.md)). That number belongs to this
one test, not to FIDE, and Scout and Tactician haven't been measured.

It learned from scratch which moves look promising and who is winning, working
through 26 million chess positions (some more than once). Not bad for a
creature that lives about 50 days. The rules come from ordinary code, so it
never plays an illegal move.

## Under the hood

The model is called **DROSO-1**, and everything you need to run it, retrain it
or train your own is in this repository:

- [How the fly plays](docs/how-it-works.md): how it sees the board and picks a move
- [How it was trained](docs/training.md), with the [recipe](docs/droso-1/recipe.md)
  and [research notes](docs/droso-1/research.md)
- [The trained model](artifacts/droso-1/README.md), ready to run in Python
- [Development](docs/development.md): run the site locally and test it
- [Data and licences](docs/data.md)

Code: [MIT](LICENSE). Connectomes: FlyWire v783, plus MaleCNS v1.0 for the
[old prototypes](artifacts/legacy/), both CC BY 4.0. The evaluation bar uses
Stockfish (GPL-3.0).
