import { FlyMascot } from "@/components/FlyMascot";
import { useEffect, useState } from "react";
import { isSelfPlay, useGameStore } from "@/state/game";
import { useUiStore } from "@/state/ui";
import { getFlyLevel } from "@/ai/bots/levels";
import { backToLobby, reasonText, rematch } from "@/game/session";
import { useTranslation } from "@/i18n";

export function GameOverDialog() {
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const myColor = useGameStore((s) => s.myColor);
  const selfPlay = useGameStore(isSelfPlay);
  const setView = useUiStore((s) => s.setView);
  const setPanelTab = useUiStore((s) => s.setPanelTab);
  const setViewPly = useGameStore((s) => s.setViewPly);
  const level = getFlyLevel(useUiStore((s) => s.level));
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
  const title = draw ? t("over.draw") : selfPlay ? t(result.winner === "w" ? "over.whiteWon" : "over.blackWon") : won ? t("over.won") : t("over.lost");
  const quipKind = selfPlay ? "self" : draw ? "draw" : won ? "win" : "loss";
  const quipCount = quipKind === "draw" || quipKind === "self" ? 3 : 4;
  const fly = (winner: boolean, caption = level.name) => (
    <figure className={winner ? "is-winner" : ""}>
      <span className="avatar" style={{ background: level.tint }}><FlyMascot variant={level.id} /></span>
      <figcaption>{caption}</figcaption>
    </figure>
  );

  return (
    <div className="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className={`game-over__card${won ? " is-win" : draw || selfPlay ? " is-draw" : " is-loss"}`}>
        <button type="button" className="game-over__close" onClick={() => setOpen(false)} aria-label={t("over.close")}>×</button>
        <header>
          <span className="game-over__trophy" aria-hidden="true">{won || (selfPlay && !draw) ? "🏆" : draw ? "🤝" : "🪰"}</span>
          <h2 id="game-over-title">{title}</h2>
          <p>{reasonText(result.reason)}</p>
          <p className="game-over__quip">{t(`over.quip.${quipKind}.${quip % quipCount}`)}</p>
        </header>
        <div className="game-over__players">
          {selfPlay ? fly(result.winner === "w", t("side.w")) : (
            <figure className={won ? "is-winner" : ""}>
              <span className="avatar"><img src="avatars/player.svg" alt="" /></span>
              <figcaption>{t("player.you")}</figcaption>
            </figure>
          )}
          <span className="game-over__vs">vs</span>
          {selfPlay ? fly(result.winner === "b", t("side.b")) : fly(!won && !draw)}
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
            <button type="button" className="btn" onClick={() => { setOpen(false); setPanelTab("brain"); setView("brain"); }}>{t("over.brain")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
