import { useEffect, useState } from "react";
import { loadOpeningBook, lookupOpening, type OpeningInfo } from "@/engine/openings";

/**
 * Resolves the current position's ECO opening name. Keeps the last matched
 * name once the game leaves the book instead of clearing it; back at the
 * game's starting position (a new game, or a takeback) it starts over.
 */
export function useOpeningName(fen: string, startFen: string): OpeningInfo | null {
  const [map, setMap] = useState<Map<string, OpeningInfo> | null>(null);
  const [current, setCurrent] = useState<OpeningInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOpeningBook().then((loaded) => {
      if (!cancelled) setMap(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const found = (map && lookupOpening(map, fen)) ?? null;
    if (fen === startFen) setCurrent(found);
    else if (found) setCurrent(found);
  }, [map, fen, startFen]);

  return current;
}
