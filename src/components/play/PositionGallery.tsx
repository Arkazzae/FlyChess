import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/state/ui";
import { boardCells, chess960Fen, parsePosition, PRESETS, type PositionPick, type PresetId } from "@/engine/positions";

/** A small, static picture of a position, White at the bottom like a book diagram. */
export function MiniBoard({ fen }: { fen: string | null }) {
  const cells = useMemo(() => (fen ? boardCells(fen) : Array<string | null>(64).fill(null)), [fen]);
  return (
    <span className="mini-board" aria-hidden="true">
      {cells.map((piece, i) => (
        <span key={i} className={`mini-board__sq${((i >> 3) + i) % 2 ? " is-dark" : ""}`}>
          {piece && <img src={`pieces/${piece}.png`} alt="" draggable={false} />}
        </span>
      ))}
    </span>
  );
}

function Card({ pick, fen, name, goal }: { pick: PositionPick; fen: string | null; name: string; goal: string }) {
  const selected = useUiStore((s) => s.positionPick) === pick;
  const setPositionPick = useUiStore((s) => s.setPositionPick);
  return (
    <button type="button" role="radio" aria-checked={selected} className={`position-card${selected ? " is-selected" : ""}`} onClick={() => setPositionPick(pick)} title={`${name}: ${goal}`}>
      <MiniBoard fen={fen} />
      <span className="position-card__name">{name}</span>
      <span className="position-card__goal">{goal}</span>
    </button>
  );
}

const GROUPS: { key: "puzzles" | "endgames"; ids: PresetId[] }[] = [
  { key: "puzzles", ids: PRESETS.filter((preset) => preset.group === "puzzle").map((preset) => preset.id) },
  { key: "endgames", ids: PRESETS.filter((preset) => preset.group === "endgame").map((preset) => preset.id) },
];

/**
 * The Positions tab: test positions, a Chess960 start or any position pasted as FEN, each shown as a
 * small board. The big board beside it shows the picked one.
 */
export function PositionGallery() {
  const positionPick = useUiStore((s) => s.positionPick);
  const chess960 = useUiStore((s) => s.chess960);
  const shuffleChess960 = useUiStore((s) => s.shuffleChess960);
  const customFen = useUiStore((s) => s.customFen);
  const setCustomFen = useUiStore((s) => s.setCustomFen);
  const { t } = useTranslation();
  const parsed = useMemo(() => parsePosition(customFen), [customFen]);
  const empty = !customFen.trim();

  let status = t("positions.fenHint");
  if (!empty) status = parsed.ok ? t(`start.toMove.${parsed.fen.split(" ")[1]}`) : t(`start.error.${parsed.error}`);

  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.key} className="bot-select__section">
          <h3>{t(`positions.${group.key}`)}</h3>
          <div className="position-grid" role="radiogroup" aria-label={t(`positions.${group.key}`)}>
            {group.ids.map((id) => (
              <Card key={id} pick={id} fen={PRESETS.find((preset) => preset.id === id)!.fen} name={t(`preset.${id}`)} goal={t(`preset.${id}.goal`)} />
            ))}
          </div>
        </div>
      ))}

      <div className="bot-select__section">
        <h3>{t("positions.other")}</h3>
        <div className="position-grid" role="radiogroup" aria-label={t("positions.other")}>
          <Card pick="chess960" fen={chess960Fen(chess960)} name="Chess960" goal={t("start.chess960Number", { n: chess960 })} />
          <Card pick="custom" fen={parsed.ok ? parsed.fen : null} name={t("positions.custom")} goal={t("positions.customGoal")} />
        </div>

        {positionPick === "chess960" && (
          <div className="start-details">
            <div className="start-960">
              <strong>{t("start.chess960Number", { n: chess960 })}</strong>
              <button type="button" className="btn start-960__shuffle" onClick={shuffleChess960}>{t("start.shuffle")}</button>
            </div>
            <p className="start-note">{t("start.chess960Note")}</p>
          </div>
        )}

        {positionPick === "custom" && (
          <div className="start-details">
            <label className="fen-field">
              <span>FEN</span>
              <input
                type="text"
                value={customFen}
                onChange={(event) => setCustomFen(event.target.value)}
                onFocus={(event) => event.target.select()}
                placeholder={t("start.fenPlaceholder")}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={!empty && !parsed.ok}
                aria-describedby="start-status"
              />
            </label>
            <p id="start-status" className={`start-status${!empty && !parsed.ok ? " is-error" : ""}`} role="status">{status}</p>
          </div>
        )}
      </div>
    </>
  );
}
