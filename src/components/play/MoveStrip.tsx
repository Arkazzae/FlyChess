import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/game";
import { moveNumbering } from "@/engine/positions";

/** Phones only: the moves as one horizontal line under the top bar, like chess apps do. */
export function MoveStrip() {
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const setViewPly = useGameStore((s) => s.setViewPly);
  const phase = useGameStore((s) => s.phase);
  const startFen = useGameStore((s) => s.startFen);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const current = viewPly ?? moves.length;

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(".is-current");
    // Horizontal only, so the page never jumps.
    if (active) strip.scrollLeft = active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2;
    else strip.scrollLeft = strip.scrollWidth;
  }, [moves.length, current]);

  if (phase === "lobby") return null;
  const { first, blackFirst } = moveNumbering(startFen);
  const offset = blackFirst ? 1 : 0;
  return (
    <div className="move-strip" ref={stripRef}>
      {moves.map((san, ply) => {
        const slot = ply + offset;
        const number = first + Math.floor(slot / 2);
        return (
          <button key={ply} type="button" className={current === ply + 1 ? "is-current" : ""} onClick={() => setViewPly(ply + 1)}>
            {slot % 2 === 0 ? <span>{number}.</span> : ply === 0 && <span>{number}…</span>}
            {san}
          </button>
        );
      })}
    </div>
  );
}
