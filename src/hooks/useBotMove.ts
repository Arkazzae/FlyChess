/**
 * Bot move scheduling, initialization and contextual reactions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { botMovesFor, isSpectating, useGameStore } from "@/state/game";
import { BotController, type BotMoveDecision } from "@/ai/bot-controller";
import { triggerChat, clearChatLog, getChatEventForMove } from "@/ai/bot-chat";
import { getOpponent } from "@/ai/bots";
import { getBotMoveDelay } from "@/ai/bot-timing";
import { CancelledSearch } from "@/ai/stockfish-player";
import { seenPositions } from "@/ai/fly/planner";
import { getTimeRemaining, isFlagged, isUnlimited, startClock } from "@/engine/clock";
import { isFlyMirror } from "@/game/session";
import { playMoveSound } from "@/sounds";
import type { Move, PieceColor, Square } from "@/engine/types";

/** Watching two bots without a clock: each move stays on the board at least this long. */
const SELF_PLAY_PLY_MS = 1200;

interface ParsedUCIMove {
  from: Square;
  to: Square;
  promotion?: string;
}

export function parseUCIMove(uci: string): ParsedUCIMove | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

export function useBotMove() {
  const controllerRef = useRef<BotController | null>(null);
  const thinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEvalRef = useRef<number | null>(null);
  /** The latest decision, so a move dropped by a pause is played on resume without thinking again. */
  const decisionRef = useRef<{ fen: string; decision: Promise<BotMoveDecision> } | null>(null);
  const [controllerReady, setControllerReady] = useState(false);

  const phase = useGameStore((state) => state.phase);
  const seats = useGameStore((state) => state.seats);
  const myColor = useGameStore((state) => state.myColor);
  const fen = useGameStore((state) => state.fen);
  const moves = useGameStore((state) => state.moves);
  const chess = useGameStore((state) => state.chess);
  const paused = useGameStore((state) => state.paused);

  // The controller lives for the whole game and moves for whichever bot is to move.
  useEffect(() => {
    if (phase !== "playing" || (!seats.w && !seats.b)) return;
    const spectating = isSpectating({ seats });
    // The same bot on both sides talks to itself; different bots take turns talking.
    const mirror = spectating && (isFlyMirror(seats) || seats.w!.id === seats.b!.id);
    const voices = [seats.w, seats.b].filter((seat) => !!seat).map((seat) => getOpponent(seat!.id));

    const controller = new BotController(seats);
    controllerRef.current = controller;
    setControllerReady(false);
    lastEvalRef.current = null;
    decisionRef.current = null;
    clearChatLog();

    let cancelled = false;
    controller
      .init()
      .then(() => {
        if (cancelled) return;
        setControllerReady(true);
        triggerChat(mirror ? "mirror" : "start", voices[Math.floor(Math.random() * voices.length)]);
      })
      .catch((error) => {
        if (!cancelled) console.error("Bot engine initialization failed:", error);
      });

    chatTimerRef.current = setInterval(() => {
      if (useGameStore.getState().phase === "playing") {
        triggerChat(mirror ? "mirror" : "idle", voices[Math.floor(Math.random() * voices.length)]);
      }
    }, 20000);

    return () => {
      cancelled = true;
      setControllerReady(false);
      controller.destroy();
      controllerRef.current = null;
      if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current);
      if (chatTimerRef.current) clearInterval(chatTimerRef.current);
    };
  }, [phase, seats]);

  const makeBotMove = useCallback(async () => {
    const controller = controllerRef.current;
    const state = useGameStore.getState();
    const botColor = state.chess.turn() as PieceColor;
    if (
      !controllerReady ||
      !controller ||
      state.phase !== "playing" ||
      state.result ||
      state.paused ||
      !botMovesFor(state, botColor)
    ) {
      return;
    }
    const spectating = isSpectating(state);
    const requestedAt = performance.now();

    // On every later move the previous player starts the bot's clock. When the
    // bot has White, however, there is no previous move, so start its clock as
    // soon as it is ready to think.
    if (!isUnlimited(state.timeControl) && !state.clock.running) {
      useGameStore.setState({ clock: startClock(state.clock, botColor) });
    }

    const requestedFen = state.chess.fen();

    try {
      if (decisionRef.current?.fen !== requestedFen) {
        const history = state.chess.history({ verbose: true });
        decisionRef.current = {
          fen: requestedFen,
          decision: controller.getMove({
            fen: requestedFen,
            history: history.map((move) => `${move.from}${move.to}${move.promotion ?? ""}`),
            halfMoves: state.moves.length,
            remainingMs: isUnlimited(state.timeControl) ? null : getTimeRemaining(state.clock, botColor),
            seen: seenPositions(history, requestedFen),
          }),
        };
      }
      const decision = await decisionRef.current.decision;
      const parsed = parseUCIMove(decision.move);
      if (!parsed) throw new Error(`Engine returned invalid UCI move: ${decision.move}`);

      const playerPerspective = myColor === "w" ? 1 : -1;
      const botPerspective = botColor === "w" ? 1 : -1;
      const evalDrop =
        lastEvalRef.current !== null && decision.positionEvaluation !== null
          ? (lastEvalRef.current - decision.positionEvaluation) * playerPerspective
          : 0;
      const botEvalBefore =
        (decision.positionEvaluation ?? 0) * botPerspective;

      const latestState = useGameStore.getState();
      const mover = getOpponent(latestState.seats[botColor]?.id);
      let moveDelay = getBotMoveDelay({
        bot: mover.bot,
        baseDelayMs: decision.thinkTime,
        remainingMs: getTimeRemaining(latestState.clock, botColor),
        timeControl: latestState.timeControl,
        halfMoves: latestState.moves.length,
      });
      // Two fast bots would otherwise move faster than anyone can follow.
      if (spectating && isUnlimited(latestState.timeControl)) {
        moveDelay = Math.max(moveDelay, SELF_PLAY_PLY_MS - (performance.now() - requestedAt));
      }

      thinkTimerRef.current = setTimeout(() => {
        thinkTimerRef.current = null;
        const currentState = useGameStore.getState();
        if (
          currentState.phase !== "playing" ||
          currentState.result ||
          currentState.paused ||
          currentState.chess.fen() !== requestedFen ||
          currentState.chess.turn() !== botColor
        ) {
          return;
        }

        // setTimeout and the display interval can be throttled independently in
        // a background tab. Check the live timestamp here so a late bot move
        // cannot revive an expired clock with the increment.
        if (!isUnlimited(currentState.timeControl) && isFlagged(currentState.clock, botColor)) {
          return;
        }

        let result;
        try {
          result = currentState.chess.move({
            from: parsed.from,
            to: parsed.to,
            promotion: parsed.promotion,
          });
        } catch {
          console.error("Bot produced an illegal move:", decision.move);
          return;
        }
        if (!result) return;

        useGameStore.getState().applyMove(result as unknown as Move);
        // Only a move that was never played is reused; a position reached again (a takeback) gets a fresh thought.
        decisionRef.current = null;

        lastEvalRef.current =
          decision.selectedEvaluation ??
          decision.positionEvaluation ??
          lastEvalRef.current;
        // Keep the fly's own judgement of the position; the eval bar shows Stockfish.
        useGameStore.getState().setEvaluation(lastEvalRef.current);

        playMoveSound(result);

        // Blunders and brilliancies are judged from the player's side; between bots, only captures are enjoyed.
        const chatEvent = spectating
          ? result.captured ? "capture" : null
          : getChatEventForMove({
              isCapture: !!result.captured,
              evalDrop,
              botEvalBefore,
              botColor,
            });
        if (chatEvent) triggerChat(chatEvent, mover);
      }, moveDelay);
    } catch (error) {
      if (decisionRef.current?.fen === requestedFen) decisionRef.current = null;
      // A search dropped by a new game or a takeback is not an error.
      if (!(error instanceof CancelledSearch)) console.error("Bot move error:", error);
    }
  }, [controllerReady, myColor]);

  useEffect(() => {
    if (!controllerReady || phase !== "playing") return;

    const state = useGameStore.getState();
    if (botMovesFor(state, chess.turn()) && !state.result && !paused) {
      const timer = setTimeout(makeBotMove, moves.length === 0 ? 300 : 80);
      return () => clearTimeout(timer);
    }
  }, [
    fen,
    phase,
    paused,
    myColor,
    makeBotMove,
    chess,
    moves.length,
    controllerReady,
  ]);
}
