import { useMemo } from "react";
import { BotPortrait } from "@/components/BotPortrait";
import { useTranslation } from "@/i18n";
import { ENGINE_MOVE_TIMES, getOpponent, OPPONENTS, type EngineConfig, type Opponent, type OpponentId } from "@/ai/bots";
import { getFlyEngine } from "@/ai/fly/engine";
import { useFlyStore } from "@/state/fly";
import { useSettingsStore } from "@/state/settings";
import { TIME_OPTIONS, useUiStore, type EngineSlot, type PlayMode, type SideChoice } from "@/state/ui";
import { startGame } from "@/game/session";
import type { PieceColor } from "@/engine/types";

const MODES: PlayMode[] = ["vsBot", "match"];
const SIDES: SideChoice[] = ["w", "random", "b"];
const COLORS: PieceColor[] = ["w", "b"];
const FLIES = OPPONENTS.filter((opponent) => opponent.kind === "fly");
const STOCKFISH_FAMILY = OPPONENTS.filter((opponent) => opponent.kind !== "fly");
const SPEAKERS = [...OPPONENTS.map((opponent) => opponent.id), "mirror", "match"];

function KingIcon({ side }: { side: SideChoice }) {
  if (side === "random") {
    return (
      <span className="side-king side-king--random">
        <img src="pieces/wk.png" alt="" />
        <img src="pieces/bk.png" alt="" />
      </span>
    );
  }
  return <span className="side-king"><img src={`pieces/${side}k.png`} alt="" /></span>;
}

function BotCard({ opponent, selected, subtitle, onSelect }: { opponent: Opponent; selected: boolean; subtitle: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`bot-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      title={`${opponent.name} — ${opponent.description}`}
    >
      <span className="bot-card__img" style={{ background: opponent.tint }}><BotPortrait still id={opponent.id} /></span>
      <span className="bot-card__name">{opponent.name}</span>
      <span className="bot-card__rating">{subtitle}</span>
    </button>
  );
}

/** Stockfish's strength for one place at the board: skill level, depth and time per move. */
function EngineSettings({ slot, config }: { slot: EngineSlot; config: EngineConfig }) {
  const setEngine = useUiStore((s) => s.setEngine);
  const { t } = useTranslation();
  return (
    <div className="engine-config">
      <label className="range">
        <span>{t("engine.skill")}</span>
        <input type="range" min={0} max={20} step={1} value={config.skill} onChange={(e) => setEngine(slot, { skill: Number(e.target.value) })} />
        <output>{config.skill}</output>
      </label>
      <label className="range">
        <span>{t("engine.depth")}</span>
        <input type="range" min={1} max={20} step={1} value={config.depth} onChange={(e) => setEngine(slot, { depth: Number(e.target.value) })} />
        <output>{config.depth}</output>
      </label>
      <label className="select">
        <span>{t("engine.time")}</span>
        <select value={config.moveTimeMs} onChange={(e) => setEngine(slot, { moveTimeMs: Number(e.target.value) })}>
          {ENGINE_MOVE_TIMES.map((ms) => <option key={ms} value={ms}>{t("engine.seconds", { s: ms / 1000 })}</option>)}
        </select>
      </label>
      <p className="bot-select__note">{t("engine.note")}</p>
    </div>
  );
}

/**
 * The pre-game screen: play a bot, or pair two bots and watch. The same picker seats the opponent,
 * or whichever side of the match is selected.
 */
export function BotSelect() {
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const opponentId = useUiStore((s) => s.opponent);
  const match = useUiStore((s) => s.match);
  const matchSide = useUiStore((s) => s.matchSide);
  const setMatchSide = useUiStore((s) => s.setMatchSide);
  const swapMatch = useUiStore((s) => s.swapMatch);
  const engine = useUiStore((s) => s.engine);
  const choose = useUiStore((s) => s.choose);
  const side = useUiStore((s) => s.side);
  const setSide = useUiStore((s) => s.setSide);
  const timeId = useUiStore((s) => s.timeId);
  const setTimeId = useUiStore((s) => s.setTimeId);
  const showThoughts = useUiStore((s) => s.showThoughts);
  const setShowThoughts = useUiStore((s) => s.setShowThoughts);
  const showEval = useUiStore((s) => s.showEval);
  const setShowEval = useUiStore((s) => s.setShowEval);
  const flyChat = useSettingsStore((s) => s.flyChat);
  const status = useFlyStore((s) => s.status);
  const { t } = useTranslation();

  const isMatch = mode === "match";
  const slot: EngineSlot = isMatch ? matchSide : "vs";
  const selectedId: OpponentId = isMatch ? match[matchSide] : opponentId;
  const opponent = getOpponent(opponentId);
  const pair = COLORS.map((color) => getOpponent(match[color]));
  const flyMirror = pair.every((bot) => bot.kind === "fly");
  const seated = isMatch ? pair : [opponent];
  const needsFly = seated.some((bot) => bot.kind === "fly");
  const speaker = isMatch ? (flyMirror ? "mirror" : "match") : opponent.id;
  // A new line every time a different bot or mode is picked.
  const speech = useMemo(() => Math.floor(Math.random() * 3), [speaker, opponentId]);

  /** Seat a bot; a fly's brain starts loading straight away so the game can begin without waiting. */
  const pick = (id: OpponentId) => {
    choose(id);
    if (getOpponent(id).kind === "fly") void getFlyEngine().useModel("droso-1");
  };
  const subtitle = (bot: Opponent) => bot.kind === "engine"
    ? t("engine.summary", { skill: engine[slot].skill, depth: engine[slot].depth })
    : bot.short;

  return (
    <div className="bot-select">
      <div className="bot-hero" title={isMatch ? undefined : opponent.description}>
        {isMatch ? (
          <div className="bot-hero__pair">
            {pair.map((bot, i) => (
              <span key={COLORS[i]} className="bot-hero__seat" style={{ background: bot.tint }}><BotPortrait still id={bot.id} /></span>
            ))}
          </div>
        ) : (
          <div className="bot-hero__portrait" style={{ background: opponent.tint }}>
            <BotPortrait still id={opponent.id} />
          </div>
        )}
        <div className="bot-hero__text">
          <div className="bot-hero__name">
            {isMatch
              ? <><strong>{pair[0].name}</strong> <span>vs</span> <strong>{pair[1].name}</strong></>
              : <><strong>{opponent.name}</strong> <span>{subtitle(opponent)}</span></>}
          </div>
          {/* Every line sits invisibly in the same cell, so the bubble keeps the height of the longest one. */}
          {flyChat && (
            <div className="speech speech--stack">
              <p>{t(`select.speech.${speaker}.${speech}`)}</p>
              {SPEAKERS.flatMap((id) => [0, 1, 2].map((i) => (
                <p key={`${id}.${i}`} className="speech__ghost" aria-hidden="true">{t(`select.speech.${id}.${i}`)}</p>
              )))}
            </div>
          )}
        </div>
      </div>

      <div className="bot-select__section">
        <div className="mode-pick" role="radiogroup" aria-label={t("mode.aria")}>
          {MODES.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={mode === item} className={mode === item ? "is-selected" : ""} onClick={() => setMode(item)}>
              {t(`mode.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {isMatch && (
        <div className="bot-select__section">
          <h3>{t("select.matchTitle")}</h3>
          <div className="match-seats">
            {COLORS.map((color, i) => (
              <button
                key={color}
                type="button"
                aria-pressed={matchSide === color}
                className={`match-seat match-seat--${color}${matchSide === color ? " is-selected" : ""}`}
                onClick={() => setMatchSide(color)}
                title={t("select.seatTitle", { side: t(`side.${color}`) })}
              >
                <span className="match-seat__img" style={{ background: pair[i].tint }}><BotPortrait still id={pair[i].id} /></span>
                <span className="match-seat__name">{pair[i].name}</span>
                <span className="match-seat__side"><img src={`pieces/${color}k.png`} alt="" />{t(`side.${color}`)}</span>
              </button>
            ))}
            <button type="button" className="match-swap" onClick={swapMatch} title={t("select.swap")} aria-label={t("select.swap")}>⇄</button>
          </div>
          <p className="bot-select__note">{t("select.matchNote", { side: t(`side.${matchSide}`) })}</p>
        </div>
      )}

      <div className="bot-select__section">
        <h3>DROSO-1 <span className="model-subtitle">{t("select.modelStyles")}</span></h3>
        <div className="bot-grid" role="radiogroup" aria-label={t("select.levelAria")}>
          {FLIES.map((item) => <BotCard key={item.id} opponent={item} selected={item.id === selectedId} subtitle={item.short} onSelect={() => pick(item.id)} />)}
        </div>
        <p className="bot-select__note">{t("select.ratingNote")}</p>
      </div>

      <div className="bot-select__section">
        <h3>Stockfish <span className="model-subtitle">{t("select.familyStyles")}</span></h3>
        <div className="bot-grid" role="radiogroup" aria-label={t("select.familyAria")}>
          {STOCKFISH_FAMILY.map((item) => <BotCard key={item.id} opponent={item} selected={item.id === selectedId} subtitle={subtitle(item)} onSelect={() => pick(item.id)} />)}
        </div>
        {selectedId === "stockfish"
          ? <EngineSettings slot={slot} config={engine[slot]} />
          : <p className="bot-select__note">{t("select.familyNote")}</p>}
      </div>

      {isMatch ? (
        <div className="bot-select__section">
          <h3>{t("select.selfTitle")}</h3>
          <p className="bot-select__self">{t(flyMirror ? "select.selfNote" : "select.watchNote")}</p>
        </div>
      ) : (
        <div className="bot-select__section">
          <h3>{t("select.playAs")}</h3>
          <div className="side-pick" role="radiogroup" aria-label={t("select.colorAria")}>
            {SIDES.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={side === item} className={side === item ? "is-selected" : ""} onClick={() => setSide(item)} title={t(`side.${item}`)} aria-label={t(`side.${item}`)}>
                <KingIcon side={item} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bot-select__section bot-select__row">
        <label className="select">
          <span>{t("select.time")}</span>
          <select value={timeId} onChange={(e) => setTimeId(e.target.value)}>
            {TIME_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.id === "none" ? t("time.none") : option.label}</option>)}
          </select>
        </label>
        {needsFly && (
          <label className="toggle">
            <input type="checkbox" checked={showThoughts} onChange={(e) => setShowThoughts(e.target.checked)} />
            <span className="toggle__track" />
            <span>{t("select.thoughts")}</span>
          </label>
        )}
        <label className="toggle">
          <input type="checkbox" checked={showEval} onChange={(e) => setShowEval(e.target.checked)} />
          <span className="toggle__track" />
          <span>{t("settings.evalBar")}</span>
        </label>
      </div>

      <div className="bot-select__footer">
        <button type="button" className="btn-play" onClick={() => startGame()} disabled={needsFly && status === "error"}>
          {t(isMatch ? "select.watch" : "select.play")}
        </button>
      </div>
    </div>
  );
}
