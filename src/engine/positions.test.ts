import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  boardCells,
  chess960Fen,
  chess960Number,
  chess960Rank,
  chosenStart,
  moveNumbering,
  openingPly,
  parsePosition,
  positionCommand,
  presetGoal,
  puzzleVerdict,
  PRESETS,
  randomChess960,
  sideToMove,
  STANDARD_FEN,
  startLabel,
} from "./positions";

function fenOf(input: string): string {
  const parsed = parsePosition(input);
  if (!parsed.ok) throw new Error(`rejected: ${parsed.error}`);
  return parsed.fen;
}

describe("parsePosition", () => {
  it("accepts the usual starting position unchanged", () => {
    expect(fenOf(STANDARD_FEN)).toBe(STANDARD_FEN);
  });

  it("fills in the fields many tools leave out", () => {
    expect(fenOf("8/8/8/4k3/8/8/8/3QK3")).toBe("8/8/8/4k3/8/8/8/3QK3 w - - 0 1");
    expect(fenOf("  8/8/8/4k3/8/8/8/3QK3 b - -  ")).toBe("8/8/8/4k3/8/8/8/3QK3 b - - 0 1");
  });

  it("drops castling rights the pieces cannot back up", () => {
    // No rook on a1 or h8: chess.js alone would offer O-O-O here.
    const fen = fenOf("r3k3/8/8/8/8/8/8/4K2R w KQkq - 0 1");
    expect(fen.split(" ")[2]).toBe("Kq");
    expect(new Chess(fen).moves()).not.toContain("O-O-O");
    // A shuffled back rank cannot castle at all.
    expect(fenOf("bnrkrqnb/pppppppp/8/8/8/8/PPPPPPPP/BNRKRQNB w KQkq - 0 1").split(" ")[2]).toBe("-");
  });

  it.each([
    ["", "format"],
    ["hello world", "format"],
    ["8/8/8/8/8/8/8/8 w - - 0 1", "kings"],
    ["4k3/8/8/8/8/8/8/3QK1K1 w - - 0 1", "kings"],
    ["4k2P/8/8/8/8/8/8/4K3 w - - 0 1", "pawns"],
    ["4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1", "material"],
    ["4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1", "check"],
    ["4k3/4Q3/4K3/8/8/8/8/8 b - - 0 1", "over"],
    ["k7/2Q5/1K6/8/8/8/8/8 b - - 0 1", "over"],
    ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "over"],
    ["4k3/8/8/8/8/8/8/3QK3 w - - 100 80", "over"],
    ["4k3/8/8/8/8/8/8/3QK3 w - - 99 80", "over"],
  ])("rejects %j as %s", (fen, error) => {
    expect(parsePosition(fen)).toEqual({ ok: false, error });
  });
});

describe("test positions", () => {
  it.each(PRESETS.map((preset) => [preset.id, preset.fen]))("%s is a playable, normalised position", (_id, fen) => {
    expect(fenOf(fen)).toBe(fen);
    expect(startLabel(fen)).toEqual({ kind: "preset", id: _id });
  });

  it("keeps the mates in 2 honest", () => {
    // Every Black defence after the key move allows mate next move.
    for (const [id, key] of [["backRank", "Re8+"], ["smothered", "Qg8+"]] as const) {
      const position = new Chess(PRESETS.find((preset) => preset.id === id)!.fen);
      position.move(key);
      for (const defence of position.moves()) {
        position.move(defence);
        expect(position.moves({ verbose: true }).some((reply) => {
          position.move(reply);
          const mate = position.isCheckmate();
          position.undo();
          return mate;
        })).toBe(true);
        position.undo();
      }
    }
  });
});

describe("Chess960", () => {
  it("numbers starts the standard way: 518 is the usual back rank", () => {
    expect(chess960Rank(518)).toBe("RNBQKBNR");
    expect(chess960Rank(0)).toBe("BBQNNRKR");
  });

  it("deals 960 distinct, legal back ranks", () => {
    const ranks = new Set<string>();
    for (let n = 0; n < 960; n++) {
      const rank = chess960Rank(n);
      ranks.add(rank);
      const bishops = [...rank].flatMap((piece, file) => (piece === "B" ? [file % 2] : []));
      expect(bishops.sort()).toEqual([0, 1]);
      expect(rank.indexOf("R")).toBeLessThan(rank.indexOf("K"));
      expect(rank.lastIndexOf("R")).toBeGreaterThan(rank.indexOf("K"));
      expect(parsePosition(chess960Fen(n)).ok).toBe(true);
    }
    expect(ranks.size).toBe(960);
  });

  it("finds the number of a start and never deals the usual one", () => {
    expect(chess960Number(chess960Fen(123))).toBe(123);
    expect(startLabel(chess960Fen(7))).toEqual({ kind: "chess960", number: 7 });
    expect(chess960Number("8/8/8/4k3/8/8/8/3QK3 w - - 0 1")).toBeNull();
    expect(randomChess960(() => 518.5 / 959)).toBe(519);
    expect(randomChess960(() => 0)).toBe(0);
    expect(randomChess960(() => 0.999999)).toBe(959);
  });
});

describe("the choice on the bot screen", () => {
  it("resolves to a position, or the reason it cannot be played", () => {
    const choice = { mode: "positions", chess960: 5, customFen: "junk" };
    expect(chosenStart({ ...choice, mode: "vsBot", positionPick: "chess960" })).toEqual({ ok: true, fen: STANDARD_FEN });
    expect(chosenStart({ ...choice, mode: "match", positionPick: "custom" })).toEqual({ ok: true, fen: STANDARD_FEN });
    expect(chosenStart({ ...choice, positionPick: "lucena" })).toEqual({ ok: true, fen: PRESETS[5].fen });
    expect(chosenStart({ ...choice, positionPick: "chess960" })).toEqual({ ok: true, fen: chess960Fen(5) });
    expect(chosenStart({ ...choice, positionPick: "custom" })).toEqual({ ok: false, error: "format" });
    expect(startLabel(STANDARD_FEN)).toEqual({ kind: "standard" });
    expect(startLabel("8/8/8/4k3/8/8/8/2Q1K3 w - - 0 1")).toEqual({ kind: "custom" });
  });
});

describe("judging a test", () => {
  const preset = (id: string) => PRESETS.find((item) => item.id === id)!;
  const play = (fen: string, moves: string[]) => {
    const position = new Chess(fen);
    for (const move of moves) position.move(move);
    return position;
  };

  it("gives the fly the side to move and knows each test's goal", () => {
    expect(sideToMove(preset("smothered").fen)).toBe("w");
    expect(sideToMove(preset("philidor").fen)).toBe("b");
    expect(presetGoal(preset("backRank").fen)).toEqual({ kind: "mate", moves: 2 });
    expect(presetGoal(chess960Fen(3))).toBeNull();
  });

  it("solves a mate in 2 only with mate on the second move", () => {
    const { fen, goal } = preset("smothered");
    expect(puzzleVerdict(goal, fen, play(fen, ["Qg8+"]), null)).toBeNull();
    expect(puzzleVerdict(goal, fen, play(fen, ["Qg8+", "Rxg8"]), null)).toBeNull();
    expect(puzzleVerdict(goal, fen, play(fen, ["Qg8+", "Rxg8", "Nf7#"]), null)).toBe("solved");
    expect(puzzleVerdict(goal, fen, play(fen, ["h3", "g6"]), null)).toBeNull();
    expect(puzzleVerdict(goal, fen, play(fen, ["h3", "g6", "g3"]), null)).toBe("failed");
  });

  it("solves the fork once the queen falls within two moves", () => {
    const { fen, goal } = preset("fork");
    expect(puzzleVerdict(goal, fen, play(fen, ["Nf6+", "Kf8"]), null)).toBeNull();
    expect(puzzleVerdict(goal, fen, play(fen, ["Nf6+", "Kf8", "Nxd7+"]), null)).toBe("solved");
    expect(puzzleVerdict(goal, fen, play(fen, ["h3", "h6", "g3"]), null)).toBe("failed");
  });

  it("judges endgames by how the game ends", () => {
    const lucena = preset("lucena"), philidor = preset("philidor");
    const at = (fen: string) => new Chess(fen);
    expect(puzzleVerdict(lucena.goal, lucena.fen, at(lucena.fen), null)).toBeNull();
    expect(puzzleVerdict(lucena.goal, lucena.fen, at(lucena.fen), { winner: "w", reason: "checkmate" })).toBe("solved");
    expect(puzzleVerdict(lucena.goal, lucena.fen, at(lucena.fen), { winner: null, reason: "threefold" })).toBe("failed");
    expect(puzzleVerdict(philidor.goal, philidor.fen, at(philidor.fen), { winner: null, reason: "fifty_moves" })).toBe("solved");
    expect(puzzleVerdict(philidor.goal, philidor.fen, at(philidor.fen), { winner: "w", reason: "checkmate" })).toBe("failed");
  });

  it("draws the board of a FEN for the small diagrams", () => {
    const cells = boardCells(STANDARD_FEN);
    expect(cells).toHaveLength(64);
    expect([cells[0], cells[4], cells[60], cells[63], cells[32]]).toEqual(["br", "bk", "wk", "wr", null]);
    expect(boardCells("garbage").every((cell) => cell === null)).toBe(true);
  });
});

describe("games from a set-up position", () => {
  it("numbers moves from the position's move number and side to move", () => {
    expect(moveNumbering(STANDARD_FEN)).toEqual({ first: 1, blackFirst: false });
    expect(moveNumbering("4k3/8/r7/4PK2/8/8/8/7R b - - 0 34")).toEqual({ first: 34, blackFirst: true });
  });

  it("tells Stockfish where the game started", () => {
    expect(positionCommand(STANDARD_FEN, [])).toBe("position startpos");
    expect(positionCommand(STANDARD_FEN, ["e2e4"])).toBe("position startpos moves e2e4");
    const fen = PRESETS[6].fen;
    expect(positionCommand(fen, ["e8f7", "h1h7"])).toBe(`position fen ${fen} moves e8f7 h1h7`);
  });

  it("only counts opening moves from the usual starting position", () => {
    expect(openingPly(STANDARD_FEN, 3)).toBe(3);
    expect(openingPly(PRESETS[0].fen, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
