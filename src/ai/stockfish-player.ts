/**
 * Stockfish as a player (public/stockfish.js, GPL-3.0, WebAssembly). Its own worker, apart from the
 * evaluation bar (stockfish.ts) and the game review (review.ts), started only when a game seats the
 * engine or one of the characters.
 *
 * This build (Stockfish 2019-08-15, multi-variant) has Skill Level 0–20 but no UCI_Elo, so its
 * strength is set by skill level, depth and time. Searches run one at a time; a search cancelled
 * before its turn never starts.
 */

export interface SearchLine {
  uci: string;
  /** Centipawns for the side to move (null while only a mate score is known). */
  cp: number | null;
  /** Moves to mate for the side to move: positive = it mates. */
  mate: number | null;
  depth: number;
}

export interface SearchRequest {
  /** Moves from the starting position in UCI, so Stockfish knows the game's repetitions. */
  moves: string[];
  skill: number;
  depth: number;
  moveTimeMs: number;
  /** Lines to report (MultiPV). */
  lines: number;
  /** Search only these moves (UCI). */
  only?: string[];
}

export interface SearchResult {
  best: string;
  /** Best line first. */
  lines: SearchLine[];
}

export class CancelledSearch extends Error {
  constructor() {
    super("The search was cancelled.");
  }
}

class StockfishPlayer {
  private worker: Worker | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private listener: ((line: string) => void) | null = null;
  private failed: ((error: Error) => void) | null = null;

  private start(): Worker {
    if (this.worker) return this.worker;
    const url = new URL("./stockfish.js", document.baseURI).href;
    const blob = new Blob([`importScripts(${JSON.stringify(url)});`], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);
    worker.onmessage = ({ data }: MessageEvent<string>) => {
      if (typeof data === "string") this.listener?.(data);
    };
    worker.onerror = (event) => {
      this.worker = null;
      this.failed?.(new Error(event.message || "Stockfish failed to start."));
    };
    worker.postMessage("uci");
    this.worker = worker;
    return worker;
  }

  search(request: SearchRequest): Promise<SearchResult> {
    const generation = this.generation;
    const job = this.queue.then(() => {
      if (generation !== this.generation) throw new CancelledSearch();
      return this.run(request);
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Clear the engine's memory between games; searches still waiting are dropped. */
  newGame(): void {
    this.cancel();
    this.queue = this.queue.then(() => this.start().postMessage("ucinewgame"));
  }

  /** Drop searches still waiting; the running one ends at its own limits and nobody reads it. */
  cancel(): void {
    this.generation++;
  }

  private run(request: SearchRequest): Promise<SearchResult> {
    const worker = this.start();
    return new Promise((resolve, reject) => {
      const lines = new Map<number, SearchLine>();
      // Output from an earlier search may still arrive; this search starts once "readyok" is back.
      let searching = false;
      this.failed = reject;
      this.listener = (data) => {
        if (!searching) {
          if (data !== "readyok") return;
          searching = true;
          worker.postMessage(`setoption name Skill Level value ${request.skill}`);
          worker.postMessage(`setoption name MultiPV value ${request.lines}`);
          worker.postMessage(request.moves.length ? `position startpos moves ${request.moves.join(" ")}` : "position startpos");
          const only = request.only?.length ? ` searchmoves ${request.only.join(" ")}` : "";
          worker.postMessage(`go depth ${request.depth} movetime ${request.moveTimeMs}${only}`);
          return;
        }
        if (data.startsWith("info") && data.includes(" score ") && data.includes(" pv ") && !data.includes("bound")) {
          const index = Number(data.match(/ multipv (\d+)/)?.[1] ?? 1);
          const cp = data.match(/ score cp (-?\d+)/);
          const mate = data.match(/ score mate (-?\d+)/);
          lines.set(index, {
            uci: data.split(" pv ")[1].split(" ")[0],
            cp: cp ? Number(cp[1]) : null,
            mate: mate ? Number(mate[1]) : null,
            depth: Number(data.match(/ depth (\d+)/)?.[1] ?? 0),
          });
        } else if (data.startsWith("bestmove")) {
          this.listener = null;
          this.failed = null;
          const best = data.split(" ")[1];
          resolve({
            best: best && best !== "(none)" ? best : "",
            lines: [...lines.entries()].sort(([a], [b]) => a - b).map(([, line]) => line),
          });
        }
      };
      worker.postMessage("isready");
    });
  }
}

export const stockfishPlayer = new StockfishPlayer();
