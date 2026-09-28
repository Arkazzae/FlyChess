/**
 * Live state of the Fly brain opponent: loading progress, its latest thought
 * and the neural activity behind it. Read by FlyBrainPanel.
 */

import { create } from "zustand";
import type { FlyDecision } from "@/ai/fly/planner";
import type { PieceColor } from "@/engine/types";

export type FlyStatus = "idle" | "loading" | "ready" | "thinking" | "error";

export interface FlyThought {
  fen: string;
  decision: FlyDecision;
  thinkMs: number;
  /** 64 × 15 stimulus in the mover frame: 6 own piece channels, 6 opponent piece channels, attacked-by-own, attacked-by-opponent. */
  retina: Float32Array;
  flipped: boolean;
}

/** A stage of thinking that has just completed while the brain keeps going. */
export interface FlyThinking {
  decision: FlyDecision;
  elapsedMs: number;
}

export interface FlyAnatomy {
  neurons: number;
  connections: number;
  groups: Uint32Array;
  positions: Float32Array;
  positioned: Uint32Array;
  groupNames: string[];
  trainedPositions: number | null;
  label: string;
}

/** How one position spread through the connectome, step by step (see FlyBrain.trace). */
export interface FlyTrace {
  id: number;
  fen: string;
  frames: Float32Array;
  flows: Float32Array;
  steps: number;
  traceMs: number;
}

/** Download of the brain, for the preloader. */
export interface FlyDownload {
  stage: "manifest" | "connectome" | "weights" | "wiring" | "done";
  /** Compressed bytes received so far over both files. */
  loaded: number;
  total: number;
}

export interface FlyBackend {
  backend: "webgpu" | "cpu";
  adapter: string;
  reason?: string;
}

interface FlyState {
  status: FlyStatus;
  backend: FlyBackend | null;
  progress: string;
  error: string | null;
  anatomy: FlyAnatomy | null;
  thought: FlyThought | null;
  thinking: FlyThinking | null;
  activity: Float32Array | null;
  /** Per neuron: 0 inner, 1 visual input, 2 game-state input, 3 readout. */
  roles: Uint8Array | null;
  trace: FlyTrace | null;
  /** Every thought of this game, keyed by the position the fly thought about (for the replay). */
  thoughts: Record<string, FlyThought>;
  /** The last thought of the fly playing each colour (both sides when it plays itself). */
  sideThoughts: Record<PieceColor, FlyThought | null>;
  /** The recording behind each colour's last thought; replays of a finished game do not change it. */
  sideTraces: Record<PieceColor, FlyTrace | null>;
  download: FlyDownload;
  setStatus: (status: FlyStatus, progress?: string) => void;
  setError: (message: string) => void;
  setAnatomy: (anatomy: FlyAnatomy) => void;
  setBackend: (backend: FlyBackend) => void;
  setThinking: (thinking: FlyThinking | null) => void;
  setThought: (thought: FlyThought, activity?: Float32Array) => void;
  clearThought: () => void;
  setRoles: (roles: Uint8Array) => void;
  setTrace: (trace: FlyTrace) => void;
  /** The recording of a position the fly is about to think about: also the brain of the side to move. */
  setThinkingTrace: (trace: FlyTrace) => void;
  setDownload: (download: FlyDownload) => void;
}

function sideToMove(fen: string): PieceColor {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export const useFlyStore = create<FlyState>((set) => ({
  status: "idle",
  progress: "",
  error: null,
  anatomy: null,
  backend: null,
  thought: null,
  thinking: null,
  activity: null,
  roles: null,
  trace: null,
  thoughts: {},
  sideThoughts: { w: null, b: null },
  sideTraces: { w: null, b: null },
  download: { stage: "manifest", loaded: 0, total: 0 },
  setStatus: (status, progress = "") => set({ status, progress, error: null }),
  setError: (message) => set({ status: "error", error: message, progress: "" }),
  setAnatomy: (anatomy) => set({ anatomy }),
  setBackend: (backend) => set({ backend }),
  setThinking: (thinking) => set({ thinking }),
  setThought: (thought, activity) => set((state) => ({
    thought, thinking: null, activity: activity ?? state.activity, status: "ready",
    thoughts: { ...state.thoughts, [thought.fen]: thought },
    sideThoughts: { ...state.sideThoughts, [sideToMove(thought.fen)]: thought },
  })),
  clearThought: () => set({
    thought: null, thinking: null, activity: null, trace: null, thoughts: {},
    sideThoughts: { w: null, b: null }, sideTraces: { w: null, b: null },
  }),
  setRoles: (roles) => set({ roles }),
  setTrace: (trace) => set({ trace }),
  setThinkingTrace: (trace) => set((state) => ({ trace, sideTraces: { ...state.sideTraces, [sideToMove(trace.fen)]: trace } })),
  setDownload: (download) => set({ download }),
}));
