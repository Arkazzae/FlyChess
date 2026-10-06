/**
 * Interface state that is not part of the chess game: which page is open, the
 * choices on the bot screen (opponent, match pairing, engine settings), the hint
 * arrow and toasts. Persisted choices live in localStorage (best effort; private
 * windows simply start fresh).
 */

import { create } from "zustand";
import { DEFAULT_ENGINE, getOpponent, normalizeEngine, type EngineConfig, type OpponentId } from "@/ai/bots";
import type { PieceColor, Square, TimeControl } from "@/engine/types";

export type View = "play" | "brain";
export type PanelTab = "game" | "brain" | "review";
export type SideChoice = "w" | "random" | "b";
/** Play against a bot, or pair two bots and watch. */
export type PlayMode = "vsBot" | "match";
/** Engine settings are kept per place: the opponent in a game against the player, and each side of a match. */
export type EngineSlot = "vs" | PieceColor;

export interface TimeOption {
  id: string;
  label: string;
  tc: TimeControl;
}

export const TIME_OPTIONS: TimeOption[] = [
  { id: "none", label: "No limit", tc: { initial: 0, increment: 0 } },
  { id: "1+0", label: "1 min", tc: { initial: 60_000, increment: 0 } },
  { id: "3+2", label: "3 | 2", tc: { initial: 180_000, increment: 2000 } },
  { id: "5+0", label: "5 min", tc: { initial: 300_000, increment: 0 } },
  { id: "10+0", label: "10 min", tc: { initial: 600_000, increment: 0 } },
  { id: "15+10", label: "15 | 10", tc: { initial: 900_000, increment: 10_000 } },
];

interface Saved {
  mode: PlayMode;
  /** The bot the player faces. */
  opponent: OpponentId;
  /** The two bots of a match. */
  match: Record<PieceColor, OpponentId>;
  engine: Record<EngineSlot, EngineConfig>;
  side: SideChoice;
  timeId: string;
  showThoughts: boolean;
  showEval: boolean;
}

const KEY = "fly-chess-thinker:ui:v2";

/** Saved choices, including those of earlier versions: one fly level, played against or watched against itself. */
function load(): Partial<Saved> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as (Omit<Partial<Saved>, "mode"> & { level?: string; mode?: string }) | null;
    if (!saved || typeof saved !== "object") return {};
    const { level, ...rest } = saved;
    const legacy = getOpponent(level).id;
    const opponent = getOpponent(saved.opponent ?? level).id;
    const engine = (saved.engine ?? {}) as Partial<Record<EngineSlot, unknown>>;
    return {
      ...rest,
      mode: saved.mode === "match" || saved.mode === "flyVsFly" ? "match" : "vsBot",
      opponent,
      match: { w: getOpponent(saved.match?.w ?? legacy).id, b: getOpponent(saved.match?.b ?? legacy).id },
      engine: { vs: normalizeEngine(engine.vs), w: normalizeEngine(engine.w), b: normalizeEngine(engine.b) },
    };
  } catch {
    return {};
  }
}
function save(state: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage is optional.
  }
}

interface UiState extends Saved {
  /** The side of the match the bot picker is changing. */
  matchSide: PieceColor;
  view: View;
  panelTab: PanelTab;
  hint: { from: Square; to: Square } | null;
  hintLoading: boolean;
  toast: { id: number; text: string } | null;
  settingsOpen: boolean;
  setView: (view: View) => void;
  setPanelTab: (tab: PanelTab) => void;
  setMode: (mode: PlayMode) => void;
  /** Seat a bot: the opponent, or the match side being changed. */
  choose: (id: OpponentId) => void;
  setMatchSide: (side: PieceColor) => void;
  swapMatch: () => void;
  setEngine: (slot: EngineSlot, patch: Partial<EngineConfig>) => void;
  setSide: (side: SideChoice) => void;
  setTimeId: (id: string) => void;
  setShowThoughts: (show: boolean) => void;
  setShowEval: (show: boolean) => void;
  setHint: (hint: { from: Square; to: Square } | null) => void;
  setHintLoading: (loading: boolean) => void;
  showToast: (text: string) => void;
  setSettingsOpen: (open: boolean) => void;
}

const initial = load();

export const useUiStore = create<UiState>((set, get) => {
  const persist = () => {
    const { mode, opponent, match, engine, side, timeId, showThoughts, showEval } = get();
    save({ mode, opponent, match, engine, side, timeId, showThoughts, showEval });
  };
  return {
    view: "play",
    panelTab: "game",
    mode: initial.mode ?? "vsBot",
    opponent: initial.opponent ?? "thinker",
    match: initial.match ?? { w: "thinker", b: "thinker" },
    engine: initial.engine ?? { vs: DEFAULT_ENGINE, w: DEFAULT_ENGINE, b: DEFAULT_ENGINE },
    matchSide: "w",
    side: initial.side ?? "w",
    timeId: initial.timeId ?? "none",
    showThoughts: initial.showThoughts ?? false,
    showEval: initial.showEval ?? true,
    hint: null,
    hintLoading: false,
    toast: null,
    settingsOpen: false,
    setView: (view) => set({ view }),
    setPanelTab: (panelTab) => set({ panelTab }),
    setMode: (mode) => { set({ mode }); persist(); },
    choose: (id) => {
      const { mode, match, matchSide } = get();
      set(mode === "match" ? { match: { ...match, [matchSide]: id } } : { opponent: id });
      persist();
    },
    setMatchSide: (matchSide) => set({ matchSide }),
    swapMatch: () => {
      const { match, engine } = get();
      set({ match: { w: match.b, b: match.w }, engine: { ...engine, w: engine.b, b: engine.w } });
      persist();
    },
    setEngine: (slot, patch) => {
      set({ engine: { ...get().engine, [slot]: normalizeEngine({ ...get().engine[slot], ...patch }) } });
      persist();
    },
    setSide: (side) => { set({ side }); persist(); },
    setTimeId: (timeId) => { set({ timeId }); persist(); },
    setShowThoughts: (showThoughts) => { set({ showThoughts }); persist(); },
    setShowEval: (showEval) => { set({ showEval }); persist(); },
    setHint: (hint) => set({ hint }),
    setHintLoading: (hintLoading) => set({ hintLoading }),
    showToast: (text) => set({ toast: { id: Date.now(), text } }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  };
});

export function timeOption(id: string): TimeOption {
  return TIME_OPTIONS.find((option) => option.id === id) ?? TIME_OPTIONS[0];
}
