import { describe, expect, it } from "vitest";
import { getEngineMoveTime, getFlyTemperature, SELF_PLAY_SAMPLED_PLIES } from "./bot-controller";
import { FLY_LEVELS, getFlyLevel } from "./bots/levels";

describe("fly move selection", () => {
  it("always plays its best move against a player", () => {
    for (const halfMoves of [0, 1, SELF_PLAY_SAMPLED_PLIES - 1, SELF_PLAY_SAMPLED_PLIES, 60]) {
      expect(getFlyTemperature(false, halfMoves)).toBe(0);
    }
  });

  it("samples only its opening moves when the player watches", () => {
    expect(getFlyTemperature(true, 0)).toBe(1);
    expect(getFlyTemperature(true, SELF_PLAY_SAMPLED_PLIES - 1)).toBe(1);
    expect(getFlyTemperature(true, SELF_PLAY_SAMPLED_PLIES)).toBe(0);
    expect(getFlyTemperature(true, 60)).toBe(0);
  });

  it("gives the Sage a ceiling of 256 simulations and lets it stop when sure", () => {
    expect(getFlyLevel("sage").plan).toEqual({ simulations: 256, adaptive: true });
    expect(FLY_LEVELS.filter((level) => level.plan.adaptive).map((level) => level.id)).toEqual(["sage"]);
    // Unknown or missing choices still fall back to the Thinker.
    expect(getFlyLevel("unknown").id).toBe("thinker");
  });
});

describe("engine move time", () => {
  it("uses the chosen limit without a clock", () => {
    expect(getEngineMoveTime(2000, null)).toBe(2000);
  });

  it("takes a slice of the clock, never more than the limit and never under 0.1 s", () => {
    expect(getEngineMoveTime(2000, 600_000)).toBe(2000);
    expect(getEngineMoveTime(5000, 35_000)).toBe(1000);
    expect(getEngineMoveTime(1000, 500)).toBe(100);
  });
});
