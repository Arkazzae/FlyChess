import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENGINE } from "@/ai/bots";

const STORAGE_KEY = "fly-chess-thinker:ui:v2";

function mockStorage(settings: string) {
  const entries = new Map([[STORAGE_KEY, settings]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  });
  return entries;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("saved opponent", () => {
  it.each([
    ["odruch", "scout"],
    ["plan", "tactician"],
    ["mysl", "thinker"],
    ["odruch4", "scout"],
    ["plan4", "tactician"],
    ["mysl4", "thinker"],
    ["reflex", "scout"], ["rookie", "scout"], ["planner", "tactician"], ["scribe", "tactician"], ["elder", "thinker"],
    ["sage", "sage"],
  ])("restores the earlier fly level %s as the opponent %s and persists the new choices", async (previous, current) => {
    const settings = { side: "b", timeId: "3+2", showThoughts: true, showEval: true };
    const storage = mockStorage(JSON.stringify({ ...settings, mode: "vsFly", level: previous }));
    const { useUiStore } = await import("./ui");

    expect(useUiStore.getState()).toMatchObject({ ...settings, mode: "vsBot", opponent: current, match: { w: current, b: current } });
    useUiStore.getState().setShowEval(false);
    const saved = JSON.parse(storage.get(STORAGE_KEY)!);
    expect(saved).toMatchObject({ ...settings, mode: "vsBot", opponent: current, showEval: false });
    expect(saved).not.toHaveProperty("level");
  });

  it.each(["marvin", "nelsen", "mitzi", "stockfish"])("restores %s", async (opponent) => {
    mockStorage(JSON.stringify({ opponent }));
    const { useUiStore } = await import("./ui");

    expect(useUiStore.getState().opponent).toBe(opponent);
  });

  it.each(["{broken", "null", "{}", '{"level":"unknown"}', '{"opponent":"magnus"}'])
    ("uses Thinker when saved settings have no valid selection: %s", async (settings) => {
      mockStorage(settings);
      const { useUiStore } = await import("./ui");

      expect(useUiStore.getState().opponent).toBe("thinker");
    });
});

describe("saved play mode", () => {
  it("turns an earlier fly vs fly into a match of that fly against itself", async () => {
    const storage = mockStorage('{"mode":"flyVsFly","level":"scout"}');
    const { useUiStore } = await import("./ui");

    expect(useUiStore.getState()).toMatchObject({ mode: "match", match: { w: "scout", b: "scout" } });
    useUiStore.getState().setMode("vsBot");
    expect(JSON.parse(storage.get(STORAGE_KEY)!).mode).toBe("vsBot");
  });

  it.each(["{}", '{"mode":"spectate"}', "{broken"])("plays against a bot when no valid mode is saved: %s", async (settings) => {
    mockStorage(settings);
    const { useUiStore } = await import("./ui");

    expect(useUiStore.getState().mode).toBe("vsBot");
  });
});

describe("match pairing", () => {
  it("seats the picked bot on the side being changed and swaps sides with their engine settings", async () => {
    const storage = mockStorage('{"mode":"match"}');
    const { useUiStore } = await import("./ui");
    const ui = useUiStore.getState;

    ui().setMatchSide("b");
    ui().choose("stockfish");
    ui().setEngine("b", { skill: 3 });
    expect(ui().match).toEqual({ w: "thinker", b: "stockfish" });
    expect(ui().opponent).toBe("thinker");

    ui().swapMatch();
    expect(ui().match).toEqual({ w: "stockfish", b: "thinker" });
    expect(ui().engine.w).toEqual({ ...DEFAULT_ENGINE, skill: 3 });
    expect(JSON.parse(storage.get(STORAGE_KEY)!).match).toEqual({ w: "stockfish", b: "thinker" });
  });

  it("keeps engine settings within the engine's limits", async () => {
    mockStorage(JSON.stringify({ engine: { vs: { skill: 99, depth: 0, moveTimeMs: 1234 } } }));
    const { useUiStore } = await import("./ui");

    expect(useUiStore.getState().engine.vs).toEqual({ skill: 20, depth: 1, moveTimeMs: DEFAULT_ENGINE.moveTimeMs });
    useUiStore.getState().setEngine("vs", { skill: -5 });
    expect(useUiStore.getState().engine.vs.skill).toBe(0);
  });
});

describe("saved positions tab", () => {
  it("remembers the tab, the picked position, a pasted FEN and a Chess960 start", async () => {
    const storage = mockStorage(JSON.stringify({ mode: "positions", positionPick: "custom", chess960: 42, customFen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1" }));
    const { useUiStore } = await import("./ui");
    const ui = useUiStore.getState;

    expect(ui()).toMatchObject({ mode: "positions", positionPick: "custom", chess960: 42, customFen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1" });
    ui().setPositionPick("chess960");
    ui().shuffleChess960();
    expect(ui().chess960).not.toBe(42);
    expect(ui().chess960).not.toBe(518);
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toMatchObject({ positionPick: "chess960", chess960: ui().chess960 });
  });

  it.each(['{"positionPick":"mateIn9"}', '{"chess960":960}', '{"chess960":"x"}', '{"customFen":7}', "{broken"])
    ("falls back to the first test position for bad saved values: %s", async (settings) => {
      mockStorage(settings);
      const { useUiStore } = await import("./ui");
      const state = useUiStore.getState();

      expect(state.positionPick).toBe("backRank");
      expect(Number.isInteger(state.chess960) && state.chess960 >= 0 && state.chess960 < 960).toBe(true);
      expect(typeof state.customFen).toBe("string");
    });
});

describe("the fly of the Positions tab", () => {
  it("is the fly level picked last, even when a Stockfish bot is seated afterwards", async () => {
    const storage = mockStorage("{}");
    const { useUiStore } = await import("./ui");
    const ui = useUiStore.getState;

    expect(ui().fly).toBe("thinker");
    ui().choose("scout");
    ui().choose("stockfish");
    expect(ui()).toMatchObject({ opponent: "stockfish", fly: "scout" });
    expect(JSON.parse(storage.get(STORAGE_KEY)!).fly).toBe("scout");
  });

  it("comes back from saved settings, or from a saved fly opponent", async () => {
    mockStorage(JSON.stringify({ opponent: "tactician" }));
    expect((await import("./ui")).useUiStore.getState().fly).toBe("tactician");
    vi.resetModules();
    mockStorage(JSON.stringify({ opponent: "marvin", fly: "sage" }));
    expect((await import("./ui")).useUiStore.getState().fly).toBe("sage");
    vi.resetModules();
    mockStorage(JSON.stringify({ opponent: "marvin", fly: "nelsen" }));
    expect((await import("./ui")).useUiStore.getState().fly).toBe("thinker");
  });
});
