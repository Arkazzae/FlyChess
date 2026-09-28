import { describe, expect, it } from "vitest";
import { getFlyTemperature, SELF_PLAY_SAMPLED_PLIES } from "./bot-controller";

describe("fly move selection", () => {
  it("always plays its best move against a player", () => {
    for (const halfMoves of [0, 1, SELF_PLAY_SAMPLED_PLIES - 1, SELF_PLAY_SAMPLED_PLIES, 60]) {
      expect(getFlyTemperature(false, halfMoves)).toBe(0);
    }
  });

  it("samples only its opening moves when it plays itself", () => {
    expect(getFlyTemperature(true, 0)).toBe(1);
    expect(getFlyTemperature(true, SELF_PLAY_SAMPLED_PLIES - 1)).toBe(1);
    expect(getFlyTemperature(true, SELF_PLAY_SAMPLED_PLIES)).toBe(0);
    expect(getFlyTemperature(true, 60)).toBe(0);
  });
});
