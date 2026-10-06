import { BotPortrait } from "@/components/BotPortrait";
import { useEffect, useState } from "react";
import { isSpectating, useGameStore } from "@/state/game";
import { useUiStore } from "@/state/ui";
import { getOpponent, type Seat } from "@/ai/bots";
import { backToLobby, hasFly, isFlyMirror, reasonText, rematch } from "@/game/session";
import { useTranslation } from "@/i18n";
import type { PieceColor } from "@/engine/types";

/** Quips per outcome: the fly's own, two per character and the engine, a few for a match. */
function quipKey(seats: Record<PieceColor, Seat | null>, spectating: boolean, outcome: "win" | "loss" | "draw", quip: number): string {
  if (spectating) return isFlyMirror(seats) ? `over.quip.self.${quip % 3}` : `over.quip.match.${quip % 3}`;
  const bot = getOpponent((seats.w ?? seats.b)!.id);
  if (bot.kind !== "fly") return `over.quip.${bot.id}.${outcome}.${quip % 2}`;
  return `over.quip.${outcome}.${quip % (outcome === "draw" ? 3 : 4)}`;
}

export function GameOverDialog() {
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const myColor = useGameStore((s) => s.myColor);
  const seats = useGameStore((s) => s.seats);
  const spectating = useGameStore(isSpectating);
  const setView = useUiStore((s) => s.setView);
  const setPanelTab = useUiStore((s) => s.setPanelTab);
  const setViewPly = useGameStore((s) => s.setViewPly);
  const [open, setOpen] = useState(false);
  const [quip] = useState(() => Math.floor(Math.random() * 12));
  const { t } = useTranslation();

  useEffect(() => {
    if (phase !== "ended" || !result) return;
    // Let the last move land before the dialog covers the board.
    const timer = setTimeout(() => setOpen(true), 450);
    return () => clearTimeout(timer);
  }, [phase, result]);
  useEffect(() => {
    if (phase !== "ended") setOpen(false);
  }, [phase]);

  if (!open || !result) return null;
  const won = result.winner !== null && result.winner === myColor;
  const draw = result.winner === null;
  const opponent = myColor ? seats[myColor === "w" ? "b" : "w"] : null;
  const rival = opponent ? getOpponent(opponent.id) : null;
  const title = draw ? t("over.draw")
    : spectating ? t(result.winner === "w" ? "over.whiteWon" : "over.blackWon")
    : won ? t("over.won")
    : rival && rival.kind !== "fly" ? t(`bot.${rival.id}.over`) : t("over.lost");
  const outcome = draw ? "draw" : won ? "win" : "loss";
  const figure = (color: PieceColor, winner: boolean) => {
    const seat = seats[color];
    const bot = seat ? getOpponent(seat.id) : null;
    // Two of the same bot are told apart by colour.
    const caption = !bot ? t("player.you") : spectating && seats.w?.id === seats.b?.id ? t(`side.${color}`) : bot.name;
    return (
      <figure className={winner ? "is-winner" : ""}>
        {bot
          ? <span className="avatar" style={{ background: bot.tint }}><BotPortrait id={bot.id} /></span>
          : <span className="avatar"><img src="avatars/player.svg" alt="" /></span>}
        <figcaption>{caption}</figcaption>
      </figure>
    );
  };
  // The player on the left; White on the left in a match.
  const left: PieceColor = myColor ?? "w";
  const right: PieceColor = left === "w" ? "b" : "w";

  return (
    <div className="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className={`game-over__card${won ? " is-win" : draw || spectating ? " is-draw" : " is-loss"}`}>
        <button type="button" className="game-over__close" onClick={() => setOpen(false)} aria-label={t("over.close")}>×</button>
        <header>
          <span className="game-over__trophy" aria-hidden="true">{won || (spectating && !draw) ? "🏆" : draw ? "🤝" : rival?.kind === "fly" ? "🪰" : "🏁"}</span>
          <h2 id="game-over-title">{title}</h2>
          <p>{reasonText(result.reason)}</p>
          <p className="game-over__quip">{t(quipKey(seats, spectating, outcome, quip))}</p>
        </header>
        <div className="game-over__players">
          {figure(left, result.winner === left)}
          <span className="game-over__vs">vs</span>
          {figure(right, result.winner === right)}
        </div>
        <div className="game-over__actions">
          <button type="button" className="btn btn--green btn--big" onClick={() => {
            setOpen(false);
            setPanelTab("review");
            setViewPly(0);
            document.querySelector(".app__main")?.scrollTo({ top: 0, behavior: "smooth" });
          }}>{t("review.open")}</button>
          <button type="button" className="btn btn--big" onClick={rematch}>{t("game.rematch")}</button>
          <div className="game-over__row">
            <button type="button" className="btn" onClick={backToLobby}>{t("game.newGame")}</button>
            {hasFly(seats) && (
              <button type="button" className="btn" onClick={() => { setOpen(false); setPanelTab("brain"); setView("brain"); }}>{t("over.brain")}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
