/**
 * Bot type definitions.
 */

export interface ChatMessages {
  start: string[];
  capture: string[];
  blunder: string[];
  trouble: string[];
  brilliantMove: string[];
  win: string[];
  loss: string[];
  idle: string[];
  /** Playing itself: said at the start and while the game goes on. */
  mirror: string[];
  /** Playing itself: said when one side has won. */
  mirrorEnd: string[];
}

export interface BotDefinition {
  id: string;
  name: string;
  /** Nominal strength; only paces the bot's hesitation on the clock (see bot-timing), never shown. */
  elo: number;
  thinkDelay: number; // base ms
  chat: ChatMessages;
  avatarUrl: string;
}
