/**
 * Opt-in paired benchmark for the same DROSO-1 weights at 64/128/256 PUCT visits.
 *
 * Run with: FLY_SEARCH_BENCHMARK=1 pnpm vitest run src/ai/fly/search-budget-benchmark.test.ts
 * This measures search cost and move changes on the fixed parity FENs; it does NOT estimate Elo.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { Chess } from "chess.js";
import { FlyBrain } from "./brain";
import { Connectome } from "./connectome";
import { FlyWeights } from "./weights";
import { plan } from "./planner";

const file = (path: string) => new URL(`../../../${path}`, import.meta.url);
function binary(path: string): ArrayBuffer {
  const bytes = gunzipSync(readFileSync(file(path)));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

it.skipIf(process.env.FLY_SEARCH_BENCHMARK !== "1")("compares fixed 64/128/256 search on identical positions", async () => {
  const brain = new FlyBrain(
    new Connectome(binary("public/data/flywire/connectome.bin.gz")),
    new FlyWeights(binary("public/data/droso-1/weights.bin.gz")),
  );
  const { fixtures } = JSON.parse(readFileSync(file("artifacts/droso-1/parity.json"), "utf8"));
  const budgets = [64, 128, 256] as const;
  const rows: Array<{ fen: string; budget: number; move: string; simulations: number; evaluations: number; elapsedMs: number }> = [];

  for (const fixture of fixtures) {
    for (const simulations of budgets) {
      const started = performance.now();
      const decision = await plan(
        new Chess(fixture.fen),
        (board) => brain.evaluate(board),
        { simulations, halfmoveKnown: fixture.halfmove_known },
      );
      rows.push({
        fen: fixture.fen,
        budget: simulations,
        move: decision.move,
        simulations: decision.simulations,
        evaluations: decision.evaluations,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
      });
      expect(decision.simulations).toBeLessThanOrEqual(simulations);
      if (simulations === 64) expect(decision.move, fixture.fen).toBe(fixture.move);
    }
  }

  const baseline = new Map(rows.filter((row) => row.budget === 64).map((row) => [row.fen, row.move]));
  const summary = budgets.map((budget) => {
    const group = rows.filter((row) => row.budget === budget);
    return {
      budget,
      positions: group.length,
      moveChangesVs64: group.filter((row) => row.move !== baseline.get(row.fen)).length,
      meanElapsedMs: Math.round(group.reduce((sum, row) => sum + row.elapsedMs, 0) / group.length * 10) / 10,
      meanEvaluations: Math.round(group.reduce((sum, row) => sum + row.evaluations, 0) / group.length * 10) / 10,
      meanSimulations: Math.round(group.reduce((sum, row) => sum + row.simulations, 0) / group.length * 10) / 10,
    };
  });
  console.info("\nDROSO-1 fixed-position search budget benchmark (not an Elo benchmark):\n" + JSON.stringify({ summary, rows }, null, 2));
}, 300_000);
