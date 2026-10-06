import { beforeEach, describe, expect, it } from "vitest";
import { startClock } from "@/engine/clock";
import { botMovesFor, isSpectating, useGameStore } from "./game";

const PLAYERS = {
  w: { userId: "white", username: "White" },
  b: { userId: "black", username: "Black" },
};

describe("game defaults", () => {
  it("resets to an unlimited game", () => {
    useGameStore.getState().newGame({
      timeControl: { initial: 300, increment: 0 },
      seats: { w: null, b: null },
      players: PLAYERS,
    });

    useGameStore.getState().reset();

    expect(useGameStore.getState().timeControl).toEqual({ initial: 0, increment: 0 });
    expect(useGameStore.getState().clock).toMatchObject({ w: 0, b: 0, running: null });
  });
});

describe("premove selection", () => {
  beforeEach(() => {
    useGameStore.getState().newGame({
      timeControl: { initial: 300, increment: 0 },
      seats: { w: { id: "marvin" }, b: null },
      players: PLAYERS,
    });
  });

  it("queues a premove while the opponent has the turn", () => {
    useGameStore.getState().selectSquare("b8");
    useGameStore.getState().selectSquare("c6");

    expect(useGameStore.getState().premove).toEqual({
      from: "b8",
      to: "c6",
      promotion: undefined,
    });
    expect(useGameStore.getState().selectedSquare).toBeNull();
  });

  it("switches the origin instead of targeting another own piece", () => {
    useGameStore.getState().selectSquare("b8");
    useGameStore.getState().selectSquare("g8");

    expect(useGameStore.getState().selectedSquare).toBe("g8");
    expect(useGameStore.getState().premove).toBeNull();
  });

  it("cancels the origin when the selected square is clicked again", () => {
    useGameStore.getState().selectSquare("b8");
    useGameStore.getState().selectSquare("b8");

    expect(useGameStore.getState().selectedSquare).toBeNull();
    expect(useGameStore.getState().premove).toBeNull();
  });

  it("preserves a queued premove while applying the opponent's move", () => {
    useGameStore.getState().selectSquare("b8");
    useGameStore.getState().selectSquare("c6");

    const state = useGameStore.getState();
    const whiteMove = state.chess.move({ from: "e2", to: "e4" });
    expect(whiteMove).toBeTruthy();
    state.applyMove(whiteMove!);

    expect(useGameStore.getState().premove).toEqual({
      from: "b8",
      to: "c6",
      promotion: undefined,
    });
  });
});

describe("local two-player game", () => {
  beforeEach(() => {
    useGameStore.getState().newGame({
      timeControl: { initial: 300, increment: 0 },
      seats: { w: null, b: null },
      players: PLAYERS,
    });
  });

  it("lets both sides move in turn without a bot", () => {
    expect(useGameStore.getState().tryMove("e2", "e4")).toMatchObject({ san: "e4" });
    expect(useGameStore.getState().tryMove("e7", "e5")).toMatchObject({ san: "e5" });

    const state = useGameStore.getState();
    expect(state.seats).toEqual({ w: null, b: null });
    expect(state.myColor).toBeNull();
    expect(state.moves).toEqual(["e4", "e5"]);
    expect(state.chess.turn()).toBe("w");
  });

  it("still rejects a move made by the wrong side", () => {
    expect(useGameStore.getState().tryMove("e7", "e5")).toBeNull();
    expect(useGameStore.getState().moves).toEqual([]);
  });

  it("tracks captures without traversing chess.js history", () => {
    useGameStore.getState().tryMove("e2", "e4");
    useGameStore.getState().tryMove("d7", "d5");
    useGameStore.getState().tryMove("e4", "d5");

    expect(useGameStore.getState().capturedPieces).toEqual({ w: [], b: ["p"] });
  });

  it("does not duplicate saved captures while replaying a standard game", () => {
    useGameStore.getState().loadPosition(
      "ignored-for-standard-games",
      ["e4", "d5", "exd5"],
      { w: [], b: ["p"] },
    );

    expect(useGameStore.getState().capturedPieces).toEqual({ w: [], b: ["p"] });
  });
});

const MATCH = { w: { id: "thinker" as const }, b: { id: "stockfish" as const, engine: { skill: 5, depth: 6, moveTimeMs: 500 } } };

describe("a game between two bots", () => {
  beforeEach(() => {
    useGameStore.getState().newGame({
      timeControl: { initial: 300, increment: 0 },
      seats: MATCH,
      players: PLAYERS,
    });
  });

  it("is watched by the player while the bots move for both colours", () => {
    const state = useGameStore.getState();
    expect(isSpectating(state)).toBe(true);
    expect(state.myColor).toBeNull();
    expect(state.seats).toEqual(MATCH);
    expect(botMovesFor(state, "w")).toBe(true);
    expect(botMovesFor(state, "b")).toBe(true);
  });

  it("does not let the watching player move or select pieces", () => {
    expect(useGameStore.getState().tryMove("e2", "e4")).toBeNull();
    useGameStore.getState().selectSquare("e2");

    const state = useGameStore.getState();
    expect(state.moves).toEqual([]);
    expect(state.selectedSquare).toBeNull();
  });

  it("stops the clock while paused and resumes without it", () => {
    const state = useGameStore.getState();
    useGameStore.setState({ clock: startClock(state.clock, "w") });

    useGameStore.getState().setPaused(true);
    expect(useGameStore.getState()).toMatchObject({ paused: true, clock: { running: null } });

    // The next bot move starts the clock again.
    useGameStore.getState().setPaused(false);
    expect(useGameStore.getState()).toMatchObject({ paused: false, clock: { running: null } });
  });

  it("starts every new game unpaused", () => {
    useGameStore.getState().setPaused(true);
    useGameStore.getState().newGame({ timeControl: { initial: 0, increment: 0 }, seats: MATCH, players: PLAYERS });

    expect(useGameStore.getState().paused).toBe(false);
  });

  it("only pauses games the player watches", () => {
    useGameStore.getState().newGame({ timeControl: { initial: 0, increment: 0 }, seats: { w: null, b: { id: "thinker" } }, players: PLAYERS });
    useGameStore.getState().setPaused(true);

    const state = useGameStore.getState();
    expect(state.paused).toBe(false);
    expect(state.myColor).toBe("w");
    expect(isSpectating(state)).toBe(false);
    expect(botMovesFor(state, "w")).toBe(false);
    expect(botMovesFor(state, "b")).toBe(true);
  });
});
