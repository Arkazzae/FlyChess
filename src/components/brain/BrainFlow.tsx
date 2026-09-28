import { useEffect, useRef } from "react";
import { useFlyStore } from "@/state/fly";
import { FlowView } from "@/brain/FlowView";
import { brainClock, sideClocks } from "@/brain/clock";
import { useTranslation } from "@/i18n";
import type { PieceColor } from "@/engine/types";

/** Signal flow between brain regions during the recorded thought (of one side's brain with `side`). */
export function BrainFlow({ compact = false, side }: { compact?: boolean; side?: PieceColor }) {
  const anatomy = useFlyStore((s) => s.anatomy);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { t, locale } = useTranslation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !anatomy) return;
    const counts = [0, 0, 0, 0, 0, 0];
    for (const g of anatomy.groups) counts[g]++;
    const view = new FlowView(canvas, anatomy.groupNames.map((_, index) => t(`group.${index}`)), counts, {
      board: t("flow.board"), readout: t("flow.readout"), move: t("flow.move"),
      layers: ["input", "sensory", "projection", "integration", "output", "readout"].map((layer) => t(`flow.layer.${layer}`)),
    }, side ? sideClocks[side] : brainClock);
    view.compact = compact;
    return () => view.dispose();
  }, [anatomy, compact, locale, t, side]);

  return (
    <div className={`brain-flow${compact ? " brain-flow--compact" : ""}`}>
      <canvas ref={canvasRef} role="img" aria-label={t("flow.aria")} />
      <ul className="brain-flow__key" aria-hidden="true">
        <li><i className="k-exc" />{t("flow.excite")}</li>
        <li><i className="k-inh" />{t("flow.inhibit")}</li>
        <li><i className="k-out" />{t("flow.readoutKey")}</li>
      </ul>
    </div>
  );
}
