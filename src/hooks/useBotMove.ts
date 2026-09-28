/**
 * Bot move scheduling, initialization and contextual reactions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { botMovesFor, isSelfPlay, useGameStore } from "@/state/game";
import { BotController, type BotMoveDecision } from "@/ai/bot-controller";
import { triggerChat, clearChatLog, getChatEventForMove } from "@/ai/bot-chat";
import { getBot } from "@/ai/bots";
import { getBotMoveDelay } from "@/ai/bot-timing";
import { seenPositions } from "@/ai/fly/planner";
import { evaluateMaterial } from "@/engine/chess";
import { getTimeRemaining, isFlagged, isUnlimited, startClock } from "@/engine/clock";
import { playMoveSound } from "@/sounds";
import { useUiStore } from "@/state/ui";
import type { Move, PieceColor, Square } from "@/engine/types";

/** Watching the fly play itself without a clock: each move stays on the board at least this long. */
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
  const botId = useGameStore((state) => state.botId);
  const myColor = useGameStore((state) => state.myColor);
  const fen = useGameStore((state) => state.fen);
  const moves = useGameStore((state) => state.moves);
  const chess = useGameStore((state) => state.chess);
  const paused = useGameStore((state) => state.paused);

  // The controller lives for the whole game; in self-play the side it moves for changes every turn.
  useEffect(() => {
    if (phase !== "playing" || !botId) return;
    const selfPlay = isSelfPlay({ botId, myColor });

    const controller = new BotController();
    controllerRef.current = controller;
    setControllerReady(false);
    lastEvalRef.current = null;
    decisionRef.current = null;
    clearChatLog();

    let cancelled = false;
    controller
      .init(botId)
      .then(() => {
        if (cancelled) return;
        controller.startGame(botId, selfPlay ? null : myColor === "w" ? "b" : "w");
        controller.setLevel(useUiStore.getState().level);
        setControllerReady(true);

        const bot = getBot(botId);
        if (bot) {
          triggerChat(selfPlay ? "mirror" : "start", bot);
        }
      })
      .catch((error) => {
        if (!cancelled) console.error("Bot engine initialization failed:", error);
      });

    chatTimerRef.current = setInterval(() => {
      const bot = getBot(botId);
      if (bot && useGameStore.getState().phase === "playing") {
        triggerChat(selfPlay ? "mirror" : "idle", bot);
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
  }, [phase, botId, myColor]);

  const makeBotMove = useCallback(async () => {
    const controller = controllerRef.current;
    const state = useGameStore.getState();
    const botColor = state.chess.turn() as PieceColor;
    if (
      !controllerReady ||
      !controller ||
      !botId ||
      state.phase !== "playing" ||
      state.result ||
      state.paused ||
      !botMovesFor(state, botColor)
    ) {
      return;
    }
    const selfPlay = isSelfPlay(state);
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
        decisionRef.current = {
          fen: requestedFen,
          decision: controller.getMove(
            requestedFen,
            state.moves.length,
            evaluateMaterial(state.chess),
            isUnlimited(state.timeControl) ? null : getTimeRemaining(state.clock, botColor),
            seenPositions(state.chess.history({ verbose: true }), requestedFen)
          ),
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
      const bot = getBot(botId);
      let moveDelay = bot
        ? getBotMoveDelay({
            bot,
            baseDelayMs: decision.thinkTime,
            remainingMs: getTimeRemaining(latestState.clock, botColor),
            timeControl: latestState.timeControl,
            halfMoves: latestState.moves.length,
          })
        : decision.thinkTime;
      // A fast brain playing itself would otherwise move faster than anyone can follow.
      if (selfPlay && isUnlimited(latestState.timeControl)) {
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

        const currentBot = getBot(botId);
        if (currentBot) {
          // Blunders and brilliancies are judged from the player's side; playing itself, the fly only enjoys captures.
          const chatEvent = selfPlay
            ? result.captured ? "capture" : null
            : getChatEventForMove({
                isCapture: !!result.captured,
                evalDrop,
                botEvalBefore,
                botColor,
              });
          if (chatEvent) triggerChat(chatEvent, currentBot);
        }
      }, moveDelay);
    } catch (error) {
      if (decisionRef.current?.fen === requestedFen) decisionRef.current = null;
      console.error("Bot move error:", error);
    }
  }, [botId, controllerReady, myColor]);

  useEffect(() => {
    if (
      !controllerReady ||
      phase !== "playing" ||
      !botId
    ) {
      return;
    }

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
    botId,
    makeBotMove,
    chess,
    moves.length,
    controllerReady,
  ]);
}
