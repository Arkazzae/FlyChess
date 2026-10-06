import { getOpponent, type OpponentId } from "@/ai/bots";

/** Portrait of a fly, a character or the engine, shared across every opponent surface. */
export function BotPortrait({ id = "thinker", thinking = false, still = false, className = "" }: {
  id?: OpponentId;
  thinking?: boolean;
  still?: boolean;
  className?: string;
}) {
  return (
    <span className={`fly-mascot fly-mascot--portrait${thinking ? " is-thinking" : ""}${still ? " fly-still" : ""}${className ? ` ${className}` : ""}`}>
      <img src={getOpponent(id).avatarUrl} width={512} height={512} alt="" decoding="async" draggable={false} />
    </span>
  );
}
