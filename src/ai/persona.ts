/**
 * How the parody characters choose a move. Stockfish ranks the candidates; the character's taste
 * (captures, checks, an early queen) and nerves (a loose choice, now and then any legal move)
 * decide which one it actually plays.
 */

import { Chess, type Move } from "chess.js";

export interface PersonaStyle {
  /** Search limits for the candidate lines (Stockfish at full skill). */
  depth: number;
  moveTimeMs: number;
  /** How many of Stockfish's best lines the character looks at. */
  lines: number;
  /** Softmax temperature in centipawns: how loosely it chooses among those lines. */
  temperature: number;
  /** Chance of ignoring the engine and playing any legal move. */
  randomMove: number;
  /** Centipawns added to moves that suit its taste. */
  captureBonus: number;
  checkBonus: number;
  /** Bonus for moving the queen, fading to nothing by `queenUntilPly`. */
  queenBonus: number;
  queenUntilPly: number;
}

export interface Candidate {
  uci: string;
  /** Centipawns for the side to move; null when the move was never searched. */
  score: number | null;
}

/** One number per line: mates outrank every material score, a quicker mate more so. */
export function scoreOf(line: { cp: number | null; mate: number | null }): number {
  if (line.mate !== null) return line.mate > 0 ? 10_000 - line.mate * 10 : -10_000 - line.mate * 10;
  return line.cp ?? 0;
}

function uciOf(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

/** Legal queen moves in UCI. */
export function queenMoves(fen: string): string[] {
  return new Chess(fen).moves({ verbose: true }).filter((move) => move.piece === "q").map(uciOf);
}

/** The bonus a move earns from the character's taste at this point of the game. */
export function tasteOf(move: Move, style: PersonaStyle, halfMoves: number): number {
  let taste = 0;
  if (move.captured) taste += style.captureBonus;
  if (/[+#]/.test(move.san)) taste += style.checkBonus;
  if (move.piece === "q" && style.queenUntilPly > 0) taste += style.queenBonus * Math.max(0, 1 - halfMoves / style.queenUntilPly);
  return taste;
}

export function choosePersonaMove(
  fen: string,
  candidates: Candidate[],
  style: PersonaStyle,
  halfMoves: number,
  random: () => number = Math.random,
): Candidate {
  const legal = new Chess(fen).moves({ verbose: true });
  if (!legal.length) throw new Error("No legal move to choose from.");
  const byUci = new Map(legal.map((move) => [uciOf(move), move]));
  const scored = candidates.filter((candidate) => candidate.score !== null && byUci.has(candidate.uci));

  if (!scored.length || random() < style.randomMove) {
    const uci = uciOf(legal[Math.floor(random() * legal.length)]);
    return { uci, score: candidates.find((candidate) => candidate.uci === uci)?.score ?? null };
  }

  const values = scored.map((candidate) => candidate.score! + tasteOf(byUci.get(candidate.uci)!, style, halfMoves));
  const top = Math.max(...values);
  const weights = values.map((value) => Math.exp((value - top) / Math.max(1, style.temperature)));
  let pick = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < scored.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return scored[i];
  }
  return scored[scored.length - 1];
}
