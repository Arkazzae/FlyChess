/**
 * Everyone who can sit at the board: the fly at its four search budgets, three parody characters
 * who play from Stockfish's candidate lines, and Stockfish itself with the player's settings.
 * A game seats two of them, or one and the player.
 */

import { t } from "@/i18n";
import { flyAvatarUrl } from "./avatars";
import { botAvatarUrl, CHARACTERS, STOCKFISH_TINT, stockfishBot, type Character, type CharacterId } from "./characters";
import { fly } from "./fly";
import { FLY_LEVELS, getFlyLevel, type FlyLevelId } from "./levels";
import type { BotDefinition } from "./types";

export type { BotDefinition } from "./types";
export type { CharacterId } from "./characters";

export type OpponentKind = "fly" | "character" | "engine";
export type OpponentId = FlyLevelId | CharacterId | "stockfish";

export interface Opponent {
  id: OpponentId;
  kind: OpponentKind;
  readonly name: string;
  /** A few words under the name on cards and player bars. */
  readonly short: string;
  readonly description: string;
  tint: string;
  avatarUrl: string;
  /** Voice in the chat bubble. */
  bot: BotDefinition;
}

/** Stockfish's strength as the player sets it (this build has no Elo option; see stockfish-player). */
export interface EngineConfig {
  /** Skill Level, 0–20. */
  skill: number;
  /** Maximum search depth in plies, 1–20. */
  depth: number;
  moveTimeMs: number;
}

export const DEFAULT_ENGINE: EngineConfig = { skill: 10, depth: 10, moveTimeMs: 1000 };
export const ENGINE_MOVE_TIMES = [100, 250, 500, 1000, 2000, 5000];

/** One side of the board taken by a bot; `engine` only when Stockfish sits there. */
export interface Seat {
  id: OpponentId;
  engine?: EngineConfig;
}

const flies: Opponent[] = FLY_LEVELS.map((level) => ({
  id: level.id,
  kind: "fly",
  get name() { return level.name; },
  get short() { return level.short; },
  get description() { return level.description; },
  tint: level.tint,
  avatarUrl: flyAvatarUrl(level.id),
  bot: fly,
}));

const characters: Opponent[] = CHARACTERS.map((character: Character) => ({
  id: character.id,
  kind: "character",
  name: character.bot.name,
  get short() { return t(`bot.${character.id}.short`); },
  get description() { return t(`bot.${character.id}.description`); },
  tint: character.tint,
  avatarUrl: botAvatarUrl(character.id),
  bot: character.bot,
}));

const engine: Opponent = {
  id: "stockfish",
  kind: "engine",
  name: stockfishBot.name,
  get short() { return t("bot.stockfish.short"); },
  get description() { return t("bot.stockfish.description"); },
  tint: STOCKFISH_TINT,
  avatarUrl: botAvatarUrl("stockfish"),
  bot: stockfishBot,
};

export const OPPONENTS: Opponent[] = [...flies, ...characters, engine];

export function isOpponentId(id: unknown): id is OpponentId {
  return OPPONENTS.some((opponent) => opponent.id === id);
}

/** Unknown or legacy ids fall back to a fly level (the Thinker by default). */
export function getOpponent(id: string | null | undefined): Opponent {
  return OPPONENTS.find((opponent) => opponent.id === id) ?? flies.find((opponent) => opponent.id === getFlyLevel(id).id)!;
}

export function getCharacter(id: OpponentId): Character | undefined {
  return CHARACTERS.find((character) => character.id === id);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.max(min, Math.min(max, value))) : fallback;
}

/** A saved or edited engine setting, kept within the engine's limits. */
export function normalizeEngine(value: unknown): EngineConfig {
  const saved = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof EngineConfig, unknown>>;
  return {
    skill: clampInt(saved.skill, 0, 20, DEFAULT_ENGINE.skill),
    depth: clampInt(saved.depth, 1, 20, DEFAULT_ENGINE.depth),
    moveTimeMs: ENGINE_MOVE_TIMES.includes(saved.moveTimeMs as number) ? saved.moveTimeMs as number : DEFAULT_ENGINE.moveTimeMs,
  };
}

export function seatFor(id: OpponentId, engineConfig: EngineConfig): Seat {
  return id === "stockfish" ? { id, engine: { ...engineConfig } } : { id };
}

/** The line under a bot's name on its player bar. */
export function seatSubtitle(seat: Seat): string {
  const opponent = getOpponent(seat.id);
  if (opponent.kind === "fly") return "DROSO-1";
  if (opponent.kind === "engine") {
    const config = seat.engine ?? DEFAULT_ENGINE;
    return t("engine.summary", { skill: config.skill, depth: config.depth });
  }
  return opponent.short;
}
