import { BotPortrait } from "@/components/BotPortrait";
import { isSpectating, useGameStore } from "@/state/game";
import { useChatStore } from "@/state/chat";
import { useSettingsStore } from "@/state/settings";
import { useFlyStore } from "@/state/fly";
import { useUiStore } from "@/state/ui";
import { getOpponent, seatSubtitle } from "@/ai/bots";
import { requestHint } from "@/ai/hint";
import { useOpeningName } from "@/hooks/useOpeningName";
import { backToLobby, downloadPgn, hasFly, reasonText, rematch, resign } from "@/game/session";
import { useTranslation } from "@/i18n";
import { MoveTable } from "./MoveTable";
import { IconBrain, IconBulb, IconChevron, IconDownload, IconFlag, IconFlip, IconGear, IconUndo } from "@/components/shell/Icons";

function BrainStrip() {
  const status = useFlyStore((s) => s.status);
  const thinking = useFlyStore((s) => s.thinking);
  const thought = useFlyStore((s) => s.thought);
  const setPanelTab = useUiStore((s) => s.setPanelTab);
  const { t } = useTranslation();
  const decision = (status === "thinking" ? thinking?.decision : undefined) ?? thought?.decision;
  const best = decision?.candidates.find((c) => c.uci === decision.move);
  return (
    <button type="button" className={`brain-strip${status === "thinking" ? " is-live" : ""}`} onClick={() => setPanelTab("brain")}>
      <IconBrain size={22} />
      <span>
        {status === "thinking"
          ? decision ? <>{t("strip.considering")} <b>{best?.san}</b> {t("strip.positions", { count: decision.simulations })}</> : t("strip.flowing")
          : decision ? <>{t("strip.played")} <b>{best?.san}</b> {t("strip.after", { count: decision.simulations })}</> : t("strip.see")}
      </span>
      <em>{t("strip.brain")}</em>
    </button>
  );
}

export function GameTab() {
  const phase = useGameStore((s) => s.phase);
  const fen = useGameStore((s) => s.fen);
  const moves = useGameStore((s) => s.moves);
  const result = useGameStore((s) => s.result);
  const myColor = useGameStore((s) => s.myColor);
  const viewPly = useGameStore((s) => s.viewPly);
  const setViewPly = useGameStore((s) => s.setViewPly);
  const takeback = useGameStore((s) => s.takeback);
  const flipBoard = useGameStore((s) => s.flipBoard);
  const seats = useGameStore((s) => s.seats);
  const spectating = useGameStore(isSpectating);
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const log = useChatStore((s) => s.log);
  const flyChat = useSettingsStore((s) => s.flyChat);
  const hintLoading = useUiStore((s) => s.hintLoading);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const showToast = useUiStore((s) => s.showToast);
  const opening = useOpeningName(fen);
  const turn = useGameStore((s) => (s.fen.split(" ")[1] === "b" ? "b" : "w"));
  const { t } = useTranslation();
  const last = log.at(-1);
  // The bubble belongs to whoever spoke last; before anyone has, to the bot the player faces (White's in a match).
  const fallback = myColor ? seats[myColor === "w" ? "b" : "w"] : seats.w;
  const speakerSeat = [seats.w, seats.b].find((seat) => seat && seat.id === last?.speaker) ?? fallback;
  const speaker = getOpponent(speakerSeat?.id ?? last?.speaker);
  const speakerThinking = phase === "playing" && !paused && !!speakerSeat && seats[turn] === speakerSeat;
  const message = last?.text ?? (speaker.kind === "fly" ? "Bzz." : "…");
  const opponent = myColor ? seats[myColor === "w" ? "b" : "w"] : null;
  const current = viewPly ?? moves.length;
  const myTurn = phase === "playing" && myColor !== null && useGameStore.getState().chess.turn() === myColor;

  const undo = () => {
    if (!takeback()) {
      showToast(t("toast.undo"));
    }
  };

  return (
    <div className="game-tab">
      <div className="bot-chat">
        <div className="bot-chat__portrait" style={{ background: speaker.tint }}><BotPortrait thinking={speakerThinking} still id={speaker.id} /></div>
        {flyChat
          ? <div className="speech" key={last?.timestamp ?? 0}><p>{message}</p></div>
          : <div className="bot-hero__name"><strong>{speaker.name}</strong> <span>{speakerSeat ? seatSubtitle(speakerSeat) : speaker.short}</span></div>}
      </div>
      {hasFly(seats) && <BrainStrip />}
      <div className="opening-row">
        <span>{opening ? <><b>{opening.eco}</b> {opening.name}</> : t("game.startPosition")}</span>
      </div>
      <MoveTable />
      {phase === "ended" && result && (
        <div className="result-row">
          <strong>{result.winner === null ? "½–½" : result.winner === "w" ? "1–0" : "0–1"}</strong>
          <span>{result.winner === null ? t("game.draw") : spectating ? t(result.winner === "w" ? "game.whiteWon" : "game.blackWon") : result.winner === myColor ? t("game.youWon") : opponent && getOpponent(opponent.id).kind !== "fly" ? t(`bot.${opponent.id}.won`) : t("game.flyWon")} {reasonText(result.reason)}</span>
        </div>
      )}
      <div className="game-tab__controls">
        {phase === "ended" ? (
          <>
            <button type="button" className="btn btn--wide" onClick={backToLobby}>{t("game.newGame")}</button>
            <button type="button" className="btn btn--wide" onClick={() => { useUiStore.getState().setPanelTab("review"); setViewPly(0); }}>{t("panel.review")}</button>
            <button type="button" className="btn btn--green btn--wide" onClick={rematch}>{t("game.rematch")}</button>
          </>
        ) : spectating ? (
          <>
            <button type="button" className="btn btn--wide" onClick={backToLobby}>{t("game.newGame")}</button>
            <button type="button" className={`btn btn--wide${paused ? " btn--green" : ""}`} onClick={() => setPaused(!paused)}>
              {paused ? `▶ ${t("game.resume")}` : `❚❚ ${t("game.pause")}`}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--icon" onClick={resign} title={t("game.resign")} aria-label={t("game.resign")} disabled={phase !== "playing"}><IconFlag /></button>
            <button type="button" className="btn btn--icon" onClick={undo} title={t("game.undo")} aria-label={t("game.undo")} disabled={phase !== "playing" || moves.length === 0}><IconUndo /></button>
            <button type="button" className={`btn btn--icon${hintLoading ? " is-loading" : ""}`} onClick={() => void requestHint()} title={t("game.hint")} aria-label={t("game.hintShort")} disabled={!myTurn || hintLoading}><IconBulb /></button>
          </>
        )}
      </div>
      <div className="game-tab__footer">
        <button type="button" onClick={downloadPgn} title={t("game.pgn")} aria-label={t("game.pgn")}><IconDownload /></button>
        <button type="button" onClick={() => setSettingsOpen(true)} title={t("settings.title")} aria-label={t("settings.title")}><IconGear /></button>
        <button type="button" onClick={flipBoard} title={t("game.flip")} aria-label={t("game.flip")}><IconFlip /></button>
        <span className="game-tab__nav">
          <button type="button" onClick={() => setViewPly(0)} disabled={current === 0} aria-label={t("game.first")}><IconChevron dir="first" /></button>
          <button type="button" onClick={() => setViewPly(current - 1)} disabled={current === 0} aria-label={t("game.prev")}><IconChevron dir="left" /></button>
          <button type="button" onClick={() => setViewPly(current + 1)} disabled={viewPly === null} aria-label={t("game.next")}><IconChevron dir="right" /></button>
          <button type="button" onClick={() => setViewPly(null)} disabled={viewPly === null} aria-label={t("game.last")}><IconChevron dir="last" /></button>
        </span>
      </div>
    </div>
  );
}
