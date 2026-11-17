/**
 * Starting positions other than the usual one: a position pasted as FEN, a few ready-made test
 * positions, and Chess960 back ranks. chess.js has no Chess960 castling, so a Chess960 start is
 * played without castling, and castling rights that the pieces cannot back up are dropped.
 */

import { Chess, validateFen } from "chess.js";
import type { GameResult } from "./types";

export const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Why a pasted position cannot start a game. */
export type PositionError = "format" | "kings" | "pawns" | "material" | "check" | "over";

export type ParsedPosition = { ok: true; fen: string } | { ok: false; error: PositionError };

/** Missing trailing fields are filled in: many tools copy only the board, or leave out the move counters. */
const FEN_DEFAULTS = ["", "w", "-", "-", "0", "1"];

/** Castling needs the king and that rook still on their original squares. */
const CASTLING: Record<string, { king: string; rook: string; piece: "K" | "k" }> = {
  K: { king: "e1", rook: "h1", piece: "K" },
  Q: { king: "e1", rook: "a1", piece: "K" },
  k: { king: "e8", rook: "h8", piece: "k" },
  q: { king: "e8", rook: "a8", piece: "k" },
};

function pieceAt(chess: Chess, square: string): string | null {
  const piece = chess.get(square as Parameters<Chess["get"]>[0]);
  return piece ? (piece.color === "w" ? piece.type.toUpperCase() : piece.type) : null;
}

/**
 * Checks a FEN for use as a starting position and returns it normalised (as chess.js writes it),
 * or the reason it cannot be played.
 */
export function parsePosition(input: string): ParsedPosition {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 6) return { ok: false, error: "format" };
  const fields = FEN_DEFAULTS.map((fallback, i) => tokens[i] ?? fallback);
  const checked = validateFen(fields.join(" "));
  if (!checked.ok) {
    const message = checked.error ?? "";
    return { ok: false, error: /king/.test(message) ? "kings" : /pawns/.test(message) ? "pawns" : "format" };
  }

  // Too many men, or more than eight pawns a side, cannot arise in a game.
  const placement = fields[0];
  for (const side of [/[PNBRQK]/g, /[pnbrqk]/g]) if ((placement.match(side) ?? []).length > 16) return { ok: false, error: "material" };
  for (const pawn of [/P/g, /p/g]) if ((placement.match(pawn) ?? []).length > 8) return { ok: false, error: "material" };

  // chess.js keeps whatever castling rights the FEN claims, even without the rook to castle with.
  const board = new Chess(`${placement} w - - 0 1`);
  const rights = [...fields[2]].filter((right) => {
    const rule = CASTLING[right];
    return rule && pieceAt(board, rule.king) === rule.piece && pieceAt(board, rule.rook) === (rule.piece === "K" ? "R" : "r");
  });
  fields[2] = rights.length ? [...new Set(rights)].join("") : "-";

  // The side that just moved cannot have left its own king in check.
  const waiting = fields[1] === "w" ? "b" : "w";
  if (new Chess(`${placement} ${waiting} - - 0 1`).inCheck()) return { ok: false, error: "check" };

  let chess: Chess;
  try {
    chess = new Chess(fields.join(" "));
  } catch {
    return { ok: false, error: "format" };
  }
  // At 99 half-moves without a capture or pawn move, a bot claims the fifty-move draw before its first move.
  if (chess.isGameOver() || Number(fields[4]) >= 99) return { ok: false, error: "over" };
  return { ok: true, fen: chess.fen() };
}

// ── Chess960 ──

/** Knight placements on the five squares left after the bishops and the queen (standard numbering). */
const KNIGHTS = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];

/** The back rank of Chess960 start number `n` (0–959; 518 is the usual RNBQKBNR), White's pieces. */
export function chess960Rank(n: number): string {
  const id = ((Math.floor(n) % 960) + 960) % 960;
  const rank: (string | null)[] = Array(8).fill(null);
  rank[(id % 4) * 2 + 1] = "B";
  rank[(Math.floor(id / 4) % 4) * 2] = "B";
  const free = () => rank.flatMap((piece, file) => (piece ? [] : [file]));
  rank[free()[Math.floor(id / 16) % 6]] = "Q";
  const [a, b] = KNIGHTS[Math.floor(id / 96)];
  const left = free();
  rank[left[a]] = "N";
  rank[left[b]] = "N";
  const [r1, k, r2] = free();
  rank[r1] = "R";
  rank[k] = "K";
  rank[r2] = "R";
  return rank.join("");
}

/** Chess960 start `n` as a FEN, without castling. */
export function chess960Fen(n: number): string {
  const rank = chess960Rank(n);
  return `${rank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${rank} w - - 0 1`;
}

/** A random Chess960 start other than the usual one. */
export function randomChess960(random: () => number = Math.random): number {
  const n = Math.floor(random() * 959);
  return n >= 518 ? n + 1 : n;
}

/** The Chess960 number of a start position, or null when it is not one. */
export function chess960Number(fen: string): number | null {
  const match = fen.match(/^([a-z]{8})\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/([A-Z]{8}) w - - 0 1$/);
  if (!match || match[1] !== match[2].toLowerCase()) return null;
  for (let n = 0; n < 960; n++) if (chess960Rank(n) === match[2]) return n;
  return null;
}

// ── Test positions ──

export type PresetId = "backRank" | "smothered" | "fork" | "queenMate" | "rookMate" | "lucena" | "philidor";

/**
 * What the side to move must achieve: mate or win the queen within a number of its own moves, or
 * win (mate) or hold the draw however long the game takes.
 */
export type Goal =
  | { kind: "mate"; moves: number }
  | { kind: "queen"; moves: number }
  | { kind: "win" }
  | { kind: "draw" };

export interface Preset {
  id: PresetId;
  /** Puzzles have one winning idea; endgames test technique over many moves. */
  group: "puzzle" | "endgame";
  fen: string;
  goal: Goal;
}

/**
 * Small tests of what a player can find, each checked with Stockfish (see positions.test.ts for the
 * claims): two mates in 2, a winning fork, the two basic mates and two rook-endgame classics.
 */
export const PRESETS: Preset[] = [
  { id: "backRank", group: "puzzle", fen: "r5k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1", goal: { kind: "mate", moves: 2 } },
  { id: "smothered", group: "puzzle", fen: "5r1k/6pp/7N/8/2Q5/8/6PP/6K1 w - - 0 1", goal: { kind: "mate", moves: 2 } },
  { id: "fork", group: "puzzle", fen: "6k1/3q1p1p/6p1/8/4N3/8/5PPP/6K1 w - - 0 1", goal: { kind: "queen", moves: 2 } },
  { id: "queenMate", group: "endgame", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1", goal: { kind: "win" } },
  { id: "rookMate", group: "endgame", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1", goal: { kind: "win" } },
  { id: "lucena", group: "endgame", fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1", goal: { kind: "win" } },
  { id: "philidor", group: "endgame", fen: "4k3/8/r7/4PK2/8/8/8/7R b - - 0 1", goal: { kind: "draw" } },
];

// ── The choice on the bot screen ──

/** A position from the Positions tab: a test position, a Chess960 start or a pasted FEN. */
export type PositionPick = PresetId | "chess960" | "custom";

export const PICKS: PositionPick[] = [...PRESETS.map((preset) => preset.id), "chess960", "custom"];

export interface StartChoice {
  /** The bot screen's tab: only the Positions tab starts anywhere but the usual position. */
  mode: string;
  positionPick: PositionPick;
  chess960: number;
  customFen: string;
}

/** The position a game would start from with these choices. */
export function chosenStart({ mode, positionPick, chess960, customFen }: StartChoice): ParsedPosition {
  if (mode !== "positions") return { ok: true, fen: STANDARD_FEN };
  if (positionPick === "chess960") return { ok: true, fen: chess960Fen(chess960) };
  if (positionPick === "custom") return parsePosition(customFen);
  return { ok: true, fen: PRESETS.find((preset) => preset.id === positionPick)?.fen ?? STANDARD_FEN };
}

/** The side to move in a FEN: in the Positions tab, the fly's side. */
export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** The goal of a test position, or null for a Chess960 start or a pasted position. */
export function presetGoal(fen: string): Goal | null {
  return PRESETS.find((preset) => preset.fen === fen)?.goal ?? null;
}

export type Verdict = "solved" | "failed";

/**
 * Whether the solver (the side to move at the start) has reached the goal, failed it, or not yet
 * (null). `result` is the game's end, if it has one.
 */
export function puzzleVerdict(goal: Goal, startFen: string, position: Chess, result: GameResult | null): Verdict | null {
  const solver = sideToMove(startFen);
  const defender = solver === "w" ? "b" : "w";
  const solverMoves = position.history({ verbose: true }).filter((move) => move.color === solver).length;
  if (goal.kind === "mate" || goal.kind === "queen") {
    const reached = goal.kind === "mate"
      ? position.isCheckmate() && position.turn() === defender
      : !position.board().some((row) => row.some((cell) => cell?.type === "q" && cell.color === defender));
    if (reached && solverMoves <= goal.moves) return "solved";
    // Out of moves (judged once the solver has made its last one), or the game ended another way.
    if (solverMoves >= goal.moves || result) return "failed";
    return null;
  }
  if (!result) return null;
  return (goal.kind === "win" ? result.winner === solver : result.winner === null) ? "solved" : "failed";
}

/** The pieces of a FEN's board, a8 first and h1 last, as "wk", "bp", … or null for an empty square. */
export function boardCells(fen: string): (string | null)[] {
  const cells: (string | null)[] = [];
  for (const char of fen.split(" ")[0].replace(/\//g, "")) {
    if (/\d/.test(char)) for (let i = 0; i < Number(char); i++) cells.push(null);
    else cells.push(`${char === char.toUpperCase() ? "w" : "b"}${char.toLowerCase()}`);
  }
  return cells.length === 64 ? cells : Array(64).fill(null);
}

/** What to call a starting position. */
export type StartLabel =
  | { kind: "standard" }
  | { kind: "preset"; id: PresetId }
  | { kind: "chess960"; number: number }
  | { kind: "custom" };

export function startLabel(fen: string): StartLabel {
  if (fen === STANDARD_FEN) return { kind: "standard" };
  const preset = PRESETS.find((item) => item.fen === fen);
  if (preset) return { kind: "preset", id: preset.id };
  const number = chess960Number(fen);
  return number === null ? { kind: "custom" } : { kind: "chess960", number };
}

/**
 * Half-moves since the usual starting position, for habits that belong to the opening (sampled
 * self-play openings, early queen sorties, quick book-like moves). A game set up from another
 * position never had that opening, so those habits stay off.
 */
export function openingPly(startFen: string, played: number): number {
  return startFen === STANDARD_FEN ? played : Number.POSITIVE_INFINITY;
}

/** Move numbering for a game that may start with Black to move or at a later move number. */
export function moveNumbering(startFen: string): { first: number; blackFirst: boolean } {
  const fields = startFen.split(" ");
  return { first: Math.max(1, Number(fields[5]) || 1), blackFirst: fields[1] === "b" };
}

/** The UCI `position` command for a game from `startFen` with these moves played. */
export function positionCommand(startFen: string, moves: string[]): string {
  const base = startFen === STANDARD_FEN ? "position startpos" : `position fen ${startFen}`;
  return moves.length ? `${base} moves ${moves.join(" ")}` : base;
}
