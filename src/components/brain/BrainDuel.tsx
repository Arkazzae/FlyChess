import { useEffect, useRef, useState } from "react";
import { useFlyStore } from "@/state/fly";
import { useGameStore } from "@/state/game";
import { sideClocks } from "@/brain/clock";
import { useTranslation } from "@/i18n";
import type { PieceColor } from "@/engine/types";
import { BrainCloud } from "./BrainCloud";
import { BrainFlow } from "./BrainFlow";
import { BrainTimeline } from "./BrainTimeline";
import { FlyRetina } from "./FlyRetina";
import { FlyThoughts, pawns } from "./FlyThoughts";

const SIDES: PieceColor[] = ["w", "b"];

/** How far the recorded wave has spread through this brain. */
function Wave({ side }: { side: PieceColor }) {
  const fillRef = useRef<HTMLElement | null>(null);
  useEffect(() => sideClocks[side].subscribe((t) => {
    if (fillRef.current) fillRef.current.style.width = `${(t / sideClocks[side].steps) * 100}%`;
  }), [side]);
  return <div className="duel-brain__wave" aria-hidden="true"><i ref={fillRef} /></div>;
}

/** One player's brain: its connectome lit by its last thought, and the move that came of it. */
function DuelBrain({ side, live, selected, onSelect }: { side: PieceColor; live: boolean; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const thought = useFlyStore((s) => s.sideThoughts[side]);
  const thinking = useFlyStore((s) => s.thinking);
  const decision = live ? thinking?.decision : thought?.decision;
  const chosen = decision?.candidates.find((candidate) => candidate.uci === decision.move);

  return (
    <div className={`duel-brain${selected ? " is-selected" : ""}${live ? " is-live" : ""}`}>
      <button type="button" className="duel-brain__head" onClick={onSelect} aria-pressed={selected}>
        <img src={`pieces/${side}k.png`} alt="" />
        <strong>{t(`side.${side}`)}</strong>
        <span>{live ? `${t("brain.badge.thinking")}…` : t("brain.badge.waiting")}</span>
      </button>
      <BrainCloud side={side} compact />
      <Wave side={side} />
      <p className="duel-brain__move">
        {chosen ? (
          <>
            {live ? t("duel.considering") : t("duel.played")} <b>{chosen.san}</b>
            <em className={chosen.value >= 0 ? "is-good" : "is-bad"} title={t("thoughts.value")}>{pawns(chosen.value)}</em>
          </>
        ) : live ? t("thoughts.looking") : t("duel.idle")}
      </p>
    </div>
  );
}

/**
 * The fly playing itself: both players' brains side by side, then one of them in detail. The
 * detail follows the brain that is thinking unless a side is picked.
 */
export function BrainDuel() {
  const { t } = useTranslation();
  const phase = useGameStore((s) => s.phase);
  const turn = useGameStore((s) => (s.fen.split(" ")[1] === "b" ? "b" : "w"));
  const status = useFlyStore((s) => s.status);
  const [pinned, setPinned] = useState<PieceColor | null>(null);
  // While the game runs, the side to move is the brain at work; afterwards, the one that made the last move.
  const active: PieceColor = phase === "playing" ? turn : turn === "w" ? "b" : "w";
  const shown = pinned ?? active;

  return (
    <div className="brain-tab brain-duel">
      <div className="duel">
        {SIDES.map((side) => (
          <DuelBrain
            key={side}
            side={side}
            live={phase === "playing" && status === "thinking" && turn === side}
            selected={shown === side}
            onSelect={() => setPinned(side)}
          />
        ))}
      </div>
      <div className="duel-pick" role="radiogroup" aria-label={t("duel.pick")}>
        {([null, ...SIDES] as const).map((side) => (
          <button key={side ?? "live"} type="button" role="radio" aria-checked={pinned === side} className={pinned === side ? "is-selected" : ""} onClick={() => setPinned(side)}>
            {side ? t(`side.${side}`) : t("duel.follow")}
          </button>
        ))}
      </div>
      <BrainTimeline side={shown} />
      <section className="panel-section">
        <h3>{t("brain.flowShort")} · {t(`side.${shown}`)}</h3>
        <BrainFlow compact side={shown} />
      </section>
      <section className="panel-section">
        <h3>{t("brain.thoughtsTitle")} · {t(`side.${shown}`)}</h3>
        <FlyThoughts limit={5} side={shown} />
      </section>
      <details className="panel-section">
        <summary>{t("brain.sees")} · {t(`side.${shown}`)}</summary>
        <FlyRetina side={shown} />
      </details>
    </div>
  );
}
