import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/game";
import { moveNumbering } from "@/engine/positions";
import type { MoveClass } from "@/ai/review";

const MARKS: Partial<Record<MoveClass, string>> = { best: "★", inaccuracy: "?!", mistake: "?", blunder: "??" };

const FIGURINES_WHITE: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
const FIGURINES_BLACK: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞" };

function San({ san, white }: { san: string; white: boolean }) {
  const piece = san[0];
  const table = white ? FIGURINES_WHITE : FIGURINES_BLACK;
  if (table[piece]) return <><span className="figurine">{table[piece]}</span>{san.slice(1)}</>;
  const promotion = san.match(/=([QRBN])/);
  if (promotion) {
    const [before, after] = san.split(promotion[0]);
    return <>{before}=<span className="figurine">{table[promotion[1]]}</span>{after}</>;
  }
  return <>{san}</>;
}

/** The move list; in a review each move can carry its class (★ best, ?! inaccuracy, ? mistake, ?? blunder). */
export function MoveTable({ classes }: { classes?: (MoveClass | null | undefined)[] } = {}) {
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const setViewPly = useGameStore((s) => s.setViewPly);
  const startFen = useGameStore((s) => s.startFen);
  const current = viewPly ?? moves.length;
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Scroll the list itself: scrollIntoView would also scroll the page and push the board away on phones.
    const active = list.querySelector<HTMLElement>(".is-current");
    if (!active) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    const top = active.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + active.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + active.offsetHeight - list.clientHeight;
  }, [moves.length, current]);

  // A game set up with Black to move opens its first row with an empty White cell ("1. …  e5").
  const { first, blackFirst } = moveNumbering(startFen);
  const offset = blackFirst ? 1 : 0;
  const rows = [];
  for (let slot = 0; slot < moves.length + offset; slot += 2) rows.push(slot);
  return (
    <div className="move-table" ref={listRef}>
      {rows.map((slot) => (
        <div className="move-table__row" key={slot}>
          <span className="move-table__no">{first + slot / 2}.</span>
          {[slot, slot + 1].map((cell) => {
            const ply = cell - offset;
            if (ply < 0) return <span key={cell} className="move-table__skip">…</span>;
            return moves[ply] !== undefined ? (
              <button key={cell} type="button" className={`move-table__move${current === ply + 1 ? " is-current" : ""}${classes?.[ply] ? ` is-${classes[ply]}` : ""}`} onClick={() => setViewPly(ply + 1)}>
                <San san={moves[ply]} white={cell % 2 === 0} />
                {classes?.[ply] && MARKS[classes[ply]!] && <span className="move-mark">{MARKS[classes[ply]!]}</span>}
              </button>
            ) : <span key={cell} />;
          })}
        </div>
      ))}
    </div>
  );
}
