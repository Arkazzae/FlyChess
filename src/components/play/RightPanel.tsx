import { useGameStore } from "@/state/game";
import { useFlyStore } from "@/state/fly";
import { useUiStore } from "@/state/ui";
import { getOpponent } from "@/ai/bots";
import { hasFly, isFlyMirror, lobbySeats } from "@/game/session";
import { BrainTab } from "@/components/brain/BrainTab";
import { IconBrain } from "@/components/shell/Icons";
import { BotSelect } from "./BotSelect";
import { GameTab } from "./GameTab";
import { ReviewTab } from "./ReviewTab";
import { useTranslation } from "@/i18n";

export function RightPanel() {
  const phase = useGameStore((s) => s.phase);
  const gameSeats = useGameStore((s) => s.seats);
  useUiStore((s) => s.mode);
  useUiStore((s) => s.opponent);
  useUiStore((s) => s.match);
  const tab = useUiStore((s) => s.panelTab);
  const setTab = useUiStore((s) => s.setPanelTab);
  const status = useFlyStore((s) => s.status);
  const { t } = useTranslation();
  const seats = phase === "lobby" ? lobbySeats("w") : gameSeats;
  const bots = [seats.w, seats.b].filter((seat) => !!seat).map((seat) => getOpponent(seat!.id));
  // The brain tab only exists while a fly is at the board.
  const brain = hasFly(seats);
  const title = bots.length === 2 ? t(isFlyMirror(seats) ? "panel.titleSelf" : "panel.titleMatch")
    : bots[0] && bots[0].kind !== "fly" ? t(`bot.${bots[0].id}.title`) : t("panel.title");
  const shown = tab === "brain" && !brain ? "game" : tab;

  return (
    <aside className="right-panel">
      <header className="right-panel__header">
        <h2>{title}</h2>
      </header>
      {phase !== "lobby" && (
        <div className="panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={shown === "game"} className={shown === "game" ? "is-active" : ""} onClick={() => setTab("game")}>
            {t("panel.game")}
          </button>
          {brain && (
            <button type="button" role="tab" aria-selected={shown === "brain"} className={shown === "brain" ? "is-active" : ""} onClick={() => setTab("brain")}>
              <IconBrain size={18} /> {t("panel.brain")} {status === "thinking" && <i className="live-dot" />}
            </button>
          )}
          {phase === "ended" && (
            <button type="button" role="tab" aria-selected={shown === "review"} className={shown === "review" ? "is-active" : ""} onClick={() => setTab("review")}>
              {t("panel.review")}
            </button>
          )}
        </div>
      )}
      <div className="right-panel__body">
        {phase === "lobby" ? <BotSelect /> : shown === "brain" ? <BrainTab /> : shown === "review" && phase === "ended" ? <ReviewTab /> : <GameTab />}
      </div>
    </aside>
  );
}
