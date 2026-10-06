/**
 * Bot controller: one per game, holding both seats and asking whoever is to move. The fly thinks
 * with the DROSO-1 connectome in src/ai/fly; the characters and Stockfish search with the
 * Stockfish player worker. If a brain or engine cannot be loaded there is no substitute: the
 * caller surfaces the failure instead.
 */

import { getCharacter, getOpponent, type Seat } from "./bots";
import { getFlyLevel } from "./bots/levels";
import { getFlyEngine } from "./fly/engine";
import { valueToCentipawns } from "./fly/planner";
import { choosePersonaMove, queenMoves, scoreOf, type Candidate } from "./persona";
import { stockfishPlayer } from "./stockfish-player";
import type { PieceColor } from "@/engine/types";

export interface BotMoveDecision {
  move: string;
  thinkTime: number;
  /** Evaluation before the bot move, from White's perspective. */
  positionEvaluation: number | null;
  /** Evaluation of the selected candidate, from White's perspective. */
  selectedEvaluation: number | null;
}

export interface MoveRequest {
  fen: string;
  /** The game's moves so far in UCI, from the starting position. */
  history: string[];
  halfMoves: number;
  /** The bot's remaining clock time; null when the game is untimed. */
  remainingMs: number | null;
  /** Position counts of the game so far: the fly's memory against repeating itself. */
  seen?: Record<string, number>;
}

/** Opening half-moves the fly samples when the player only watches; later moves, and every move against a player, are its best. */
export const SELF_PLAY_SAMPLED_PLIES = 8;

/**
 * Against a player the fly always picks its most-visited move (temperature 0, the rated setting).
 * In a game between bots that would repeat the same game every time, so it samples its opening
 * moves in proportion to their search visits: only moves the search actually looked at can be chosen.
 */
export function getFlyTemperature(spectating: boolean, halfMoves: number): number {
  return spectating && halfMoves < SELF_PLAY_SAMPLED_PLIES ? 1 : 0;
}

/** Thinking time for the Fly: generous without a clock, a slice of the remaining time with one. */
export function getFlyThinkingBudget(remainingMs: number | null, halfMoves: number): number {
  if (remainingMs === null) return halfMoves < 6 ? 1800 : 3500;
  return Math.round(Math.max(350, Math.min(5000, remainingMs / 35)));
}

/** Stockfish's time for a move: its own limit, cut to a slice of the clock when one runs. */
export function getEngineMoveTime(limitMs: number, remainingMs: number | null): number {
  if (remainingMs === null) return limitMs;
  return Math.round(Math.max(100, Math.min(limitMs, remainingMs / 35)));
}

function sideToMove(fen: string): PieceColor {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export class BotController {
  private readonly seats: Record<PieceColor, Seat | null>;
  /** No player at the board: bots on both sides. */
  private readonly spectating: boolean;

  constructor(seats: Record<PieceColor, Seat | null>) {
    this.seats = seats;
    this.spectating = !!seats.w && !!seats.b;
  }

  private kinds() {
    return [this.seats.w, this.seats.b].filter((seat): seat is Seat => !!seat).map((seat) => getOpponent(seat.id).kind);
  }

  async init(): Promise<void> {
    const kinds = this.kinds();
    if (kinds.some((kind) => kind !== "fly")) stockfishPlayer.newGame();
    if (kinds.includes("fly")) await getFlyEngine().init();
  }

  async getMove(request: MoveRequest): Promise<BotMoveDecision> {
    const seat = this.seats[sideToMove(request.fen)];
    if (!seat) throw new Error("It is the player's move, not the bot's.");
    const opponent = getOpponent(seat.id);
    const startedAt = performance.now();
    const decision = opponent.kind === "fly" ? await this.flyMove(seat, request)
      : opponent.kind === "engine" ? await this.engineMove(seat, request)
      : await this.characterMove(seat, request);
    const elapsed = performance.now() - startedAt;
    const delay = request.remainingMs === null ? opponent.bot.thinkDelay : Math.min(opponent.bot.thinkDelay, getFlyThinkingBudget(request.remainingMs, request.halfMoves));
    // The thinking itself is the pause; only top up when the answer came instantly (forced move, cache, shallow search).
    return { ...decision, thinkTime: Math.max(60, Math.round(delay * 0.5 - elapsed)) };
  }

  /** Complete the selected PUCT budget in untimed games; respect the clock in timed games. */
  private async flyMove(seat: Seat, { fen, halfMoves, remainingMs, seen }: MoveRequest): Promise<Omit<BotMoveDecision, "thinkTime">> {
    const level = getFlyLevel(seat.id);
    const { decision } = await getFlyEngine().think(fen, {
      ...level.plan,
      temperature: getFlyTemperature(this.spectating, halfMoves),
      budgetMs: remainingMs === null ? undefined : getFlyThinkingBudget(remainingMs, halfMoves),
      seen,
    });
    const toWhite = sideToMove(fen) === "w" ? 1 : -1;
    const chosen = decision.candidates.find((candidate) => candidate.uci === decision.move);
    return {
      move: decision.move,
      positionEvaluation: valueToCentipawns(decision.value[0]) * toWhite,
      selectedEvaluation: chosen ? valueToCentipawns(chosen.value) * toWhite : null,
    };
  }

  private async engineMove(seat: Seat, { fen, history, remainingMs }: MoveRequest): Promise<Omit<BotMoveDecision, "thinkTime">> {
    const config = seat.engine!;
    const result = await stockfishPlayer.search({
      moves: history, skill: config.skill, depth: config.depth, lines: 1, moveTimeMs: getEngineMoveTime(config.moveTimeMs, remainingMs),
    });
    if (!result.best) throw new Error("Stockfish found no move.");
    const toWhite = sideToMove(fen) === "w" ? 1 : -1;
    const main = result.lines[0];
    const chosen = result.lines.find((line) => line.uci === result.best);
    return {
      move: result.best,
      positionEvaluation: main ? scoreOf(main) * toWhite : null,
      selectedEvaluation: chosen ? scoreOf(chosen) * toWhite : null,
    };
  }

  private async characterMove(seat: Seat, { fen, history, halfMoves, remainingMs }: MoveRequest): Promise<Omit<BotMoveDecision, "thinkTime">> {
    const { style } = getCharacter(seat.id)!;
    const search = { moves: history, skill: 20, depth: style.depth, moveTimeMs: getEngineMoveTime(style.moveTimeMs, remainingMs) };
    const result = await stockfishPlayer.search({ ...search, lines: style.lines });
    const candidates: Candidate[] = result.lines.map((line) => ({ uci: line.uci, score: scoreOf(line) }));
    // Stockfish rarely ranks an early queen sortie among its best lines; a queen lover looks at them anyway.
    if (style.queenBonus > 0 && halfMoves < style.queenUntilPly) {
      const queen = queenMoves(fen);
      if (queen.length && !candidates.some((candidate) => queen.includes(candidate.uci))) {
        const sortie = await stockfishPlayer.search({ ...search, lines: Math.min(3, queen.length), only: queen });
        candidates.push(...sortie.lines.map((line) => ({ uci: line.uci, score: scoreOf(line) })));
      }
    }
    const chosen = choosePersonaMove(fen, candidates, style, halfMoves);
    const toWhite = sideToMove(fen) === "w" ? 1 : -1;
    return {
      move: chosen.uci,
      positionEvaluation: candidates.length ? candidates[0].score! * toWhite : null,
      selectedEvaluation: chosen.score === null ? null : chosen.score * toWhite,
    };
  }

  destroy(): void {
    // The fly brain is shared for the whole session (large download); only queued engine searches are dropped.
    if (this.kinds().some((kind) => kind !== "fly")) stockfishPlayer.cancel();
  }
}
