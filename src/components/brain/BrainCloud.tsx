import { useEffect, useRef, useState } from "react";
import { useFlyStore } from "@/state/fly";
import { CloudView, GROUP_COLORS } from "@/brain/CloudView";
import { brainClock, sideClocks } from "@/brain/clock";
import { useTranslation } from "@/i18n";
import type { PieceColor } from "@/engine/types";

/**
 * The 3-D connectome, animated by the recorded thought: the fly's latest one, or with `side` the
 * last one of the fly playing that colour. `compact` leaves out the legend and reset button.
 */
export function BrainCloud({ large = false, side, compact = false }: { large?: boolean; side?: PieceColor; compact?: boolean }) {
  const anatomy = useFlyStore((s) => s.anatomy);
  const roles = useFlyStore((s) => s.roles);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<CloudView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [showRoles, setShowRoles] = useState(true);
  const [focus, setFocus] = useState(-1);
  const { t } = useTranslation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !anatomy) return;
    try {
      // The resting activity belongs to whichever side thought last, so a side's brain waits for its own recording.
      viewRef.current = side
        ? new CloudView(canvas, anatomy, roles, () => null, sideClocks[side])
        : new CloudView(canvas, anatomy, roles, () => useFlyStore.getState().activity, brainClock);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    }
    return () => {
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, [anatomy, roles, side]);

  useEffect(() => {
    if (viewRef.current) viewRef.current.options = { ...viewRef.current.options, roles: showRoles, focus };
  }, [showRoles, focus, anatomy, roles]);

  return (
    <div className={`brain-cloud${large ? " brain-cloud--large" : ""}`}>
      <canvas ref={canvasRef} tabIndex={0} aria-label={t("cloud.aria")} />
      {!anatomy && <div className="brain-cloud__empty">{t("cloud.loading")}</div>}
      {failed && <div className="brain-cloud__empty">{t("cloud.webgl", { error: failed })}</div>}
      {anatomy && !compact && (
        <div className="brain-cloud__legend">
          {large && anatomy.groupNames.map((_, index) => t(`group.${index}`)).map((name, index) => (
            <button
              key={index}
              type="button"
              className={focus === index ? "is-on" : focus >= 0 ? "is-dim" : ""}
              onClick={() => setFocus(focus === index ? -1 : index)}
              title={focus === index ? t("cloud.showAll") : t("cloud.showOnly", { name })}
            >
              <i style={{ background: GROUP_COLORS[index] }} />
              {name}
            </button>
          ))}
          <button type="button" className={showRoles ? "is-on legend-roles" : "legend-roles"} onClick={() => setShowRoles(!showRoles)} title={t("cloud.rolesTitle")}>
            <i className="legend-roles__dot" />
            {t("cloud.roles")}
          </button>
        </div>
      )}
      {!compact && (
        <button type="button" className="brain-cloud__reset" onClick={() => viewRef.current?.resetView()} title={t("cloud.reset")} aria-label={t("cloud.reset")}>⟲</button>
      )}
    </div>
  );
}
