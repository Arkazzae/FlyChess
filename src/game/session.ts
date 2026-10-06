/**
 * Starting, restarting and ending games: the player against a bot, or a match between two bots.
 */

import { isSpectating, useGameStore } from "@/state/game";
import { useFlyStore } from "@/state/fly";
import { timeOption, useUiStore } from "@/state/ui";
import { getFlyEngine } from "@/ai/fly/engine";
import { triggerChat } from "@/ai/bot-chat";
import { getOpponent, seatFor, type Seat } from "@/ai/bots";
import { resumeAudio } from "@/sounds";
import type { GameResult, PieceColor, PlayerInfo } from "@/engine/types";
import { t } from "@/i18n";

type Seats = Record<PieceColor, Seat | null>;

/** The seats picked on the bot screen; null is the player's side, rolled now when "random" unless given. */
export function lobbySeats(playerSide?: PieceColor): Seats {
  const ui = useUiStore.getState();
  if (ui.mode === "match") return { w: seatFor(ui.match.w, ui.engine.w), b: seatFor(ui.match.b, ui.engine.b) };
  const bot = seatFor(ui.opponent, ui.engine.vs);
  const side: PieceColor = playerSide ?? (ui.side === "random" ? (Math.random() < 0.5 ? "w" : "b") : ui.side);
  return side === "w" ? { w: null, b: bot } : { w: bot, b: null };
}

/** Both bots are the fly (at any search budget), so its own mirror lines and two brains apply. */
export function isFlyMirror(seats: Seats): boolean {
  return !!seats.w && !!seats.b && getOpponent(seats.w.id).kind === "fly" && getOpponent(seats.b.id).kind === "fly";
}

/** Whether a fly sits at the board, so its brain has something to show. */
export function hasFly(seats: Seats): boolean {
  return [seats.w, seats.b].some((seat) => !!seat && getOpponent(seat.id).kind === "fly");
}

function playerInfo(seat: Seat | null): PlayerInfo {
  if (!seat) return { userId: "player", username: t("player.you"), avatarUrl: "avatars/player.svg" };
  const opponent = getOpponent(seat.id);
  return { userId: opponent.id, username: opponent.name, avatarUrl: opponent.avatarUrl };
}

/** Start a game with the choices from the bot screen, or with the given seats for a rematch. */
export function startGame(seats: Seats = lobbySeats()): void {
  resumeAudio();
  const ui = useUiStore.getState();
  // The fly's first thought waits for its brain to be in place.
  if (hasFly(seats)) void getFlyEngine().useModel("droso-1");
  useFlyStore.getState().clearThought();
  ui.setHint(null);
  ui.setPanelTab("game");
  useGameStore.getState().newGame({
    timeControl: timeOption(ui.timeId).tc,
    seats,
    players: { w: playerInfo(seats.w), b: playerInfo(seats.b) },
  });
}

export function rematch(): void {
  const { seats } = useGameStore.getState();
  // Like a rematch on a chess site: colours swap, for the player and in a match alike.
  startGame({ w: seats.b, b: seats.w });
}

export function backToLobby(): void {
  useUiStore.getState().setHint(null);
  useGameStore.getState().reset();
}

export function finishGame(result: GameResult): void {
  const state = useGameStore.getState();
  if (state.phase !== "playing") return;
  state.setResult(result);
  if (!result.winner) return;
  const { seats } = state;
  const mirror = seats.w && seats.b && (isFlyMirror(seats) || seats.w.id === seats.b.id);
  // Against the player the bot speaks either way; in a match the winner does.
  const speaker = seats[result.winner] ?? seats[result.winner === "w" ? "b" : "w"];
  if (!speaker) return;
  triggerChat(mirror ? "mirrorEnd" : seats[result.winner] ? "win" : "loss", getOpponent(speaker.id));
}

export function resign(): void {
  const { myColor, phase } = useGameStore.getState();
  if (phase !== "playing" || !myColor) return;
  finishGame({ winner: myColor === "w" ? "b" : "w", reason: "resignation" });
}

/** "by checkmate", "on time", … in the current language. */
export function reasonText(reason: GameResult["reason"]): string {
  return t(`reason.${reason}`);
}

export function downloadPgn(): void {
  const state = useGameStore.getState();
  const { chess, players, result, myColor, seats } = state;
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const white = players.w?.username ?? t("side.w");
  const black = players.b?.username ?? t("side.b");
  const bot = myColor ? seats[myColor === "w" ? "b" : "w"] : null;
  chess.setHeader("Event", isSpectating(state)
    ? isFlyMirror(seats) ? t("pgn.eventSelf") : t("pgn.eventMatch", { white, black })
    : bot && getOpponent(bot.id).kind !== "fly" ? t("pgn.eventBot", { name: getOpponent(bot.id).name }) : t("pgn.event"));
  chess.setHeader("Site", "FlyChess.bzz");
  chess.setHeader("Date", `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`);
  chess.setHeader("White", white);
  chess.setHeader("Black", black);
  chess.setHeader("Result", result ? (result.winner === "w" ? "1-0" : result.winner === "b" ? "0-1" : "1/2-1/2") : "*");
  const blob = new Blob([chess.pgn() + "\n"], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flychess-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.pgn`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
