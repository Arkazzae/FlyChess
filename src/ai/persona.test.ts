import { describe, expect, it } from "vitest";
import { choosePersonaMove, queenMoves, scoreOf, tasteOf, type PersonaStyle } from "./persona";
import { CHARACTERS } from "./bots/characters";
import { Chess } from "chess.js";

const START = new Chess().fen();
const AFTER_E4_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const STRICT: PersonaStyle = { depth: 1, moveTimeMs: 100, lines: 3, temperature: 1, randomMove: 0, captureBonus: 0, checkBonus: 0, queenBonus: 0, queenUntilPly: 0 };
const style = (id: string) => CHARACTERS.find((character) => character.id === id)!.style;

describe("persona move choice", () => {
  it("ranks mates above any material and a quicker mate higher", () => {
    expect(scoreOf({ cp: null, mate: 1 })).toBeGreaterThan(scoreOf({ cp: null, mate: 3 }));
    expect(scoreOf({ cp: null, mate: 3 })).toBeGreaterThan(scoreOf({ cp: 2000, mate: null }));
    expect(scoreOf({ cp: null, mate: -1 })).toBeLessThan(scoreOf({ cp: null, mate: -4 }));
  });

  it("plays the best line when it chooses strictly", () => {
    const candidates = [{ uci: "e2e4", score: 40 }, { uci: "d2d4", score: 10 }, { uci: "a2a3", score: -30 }];
    expect(choosePersonaMove(START, candidates, STRICT, 0, () => 0.5).uci).toBe("e2e4");
  });

  it("ignores lines that are not legal here", () => {
    expect(choosePersonaMove(START, [{ uci: "e7e5", score: 900 }, { uci: "d2d4", score: 0 }], STRICT, 0, () => 0.5).uci).toBe("d2d4");
  });

  it("plays any legal move when its nerves go", () => {
    const legal = new Chess().moves({ verbose: true }).map((move) => `${move.from}${move.to}`);
    const move = choosePersonaMove(START, [{ uci: "e2e4", score: 40 }], { ...STRICT, randomMove: 1 }, 0, () => 0.99);
    expect(legal).toContain(move.uci);
  });

  it("lets Nelsen prefer an early queen sortie and lose interest later", () => {
    const nelsen = style("nelsen");
    const queen = new Chess(AFTER_E4_E5).moves({ verbose: true }).find((move) => move.san === "Qh5")!;
    expect(queenMoves(AFTER_E4_E5)).toContain("d1h5");
    expect(tasteOf(queen, nelsen, 2)).toBeGreaterThan(100);
    expect(tasteOf(queen, nelsen, nelsen.queenUntilPly)).toBe(0);
    // A queen move a pawn worse than the knight still wins out at move two.
    const candidates = [{ uci: "b1c3", score: 110 }, { uci: "d1h5", score: 0 }];
    expect(choosePersonaMove(AFTER_E4_E5, candidates, { ...nelsen, temperature: 1, randomMove: 0 }, 2, () => 0.5).uci).toBe("d1h5");
  });

  it("keeps the characters ordered from loosest to strictest", () => {
    const [marvin, nelsen, mitzi] = ["marvin", "nelsen", "mitzi"].map(style);
    expect(marvin.randomMove).toBeGreaterThan(nelsen.randomMove);
    expect(nelsen.randomMove).toBeGreaterThanOrEqual(mitzi.randomMove);
    expect(marvin.temperature).toBeGreaterThan(nelsen.temperature);
    expect(nelsen.temperature).toBeGreaterThan(mitzi.temperature);
    expect(mitzi.depth).toBeGreaterThan(nelsen.depth);
    expect(nelsen.depth).toBeGreaterThan(marvin.depth);
  });
});
