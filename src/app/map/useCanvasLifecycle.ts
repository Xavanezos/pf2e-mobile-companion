// src/app/map/useCanvasLifecycle.ts
import { useEffect } from "react";
import { resumeCanvas, pauseCanvas, viewActiveScene, fitActiveScene } from "../../foundry/canvas/lifecycle";

/** Map-tab canvas lifecycle. TabContent mounts/unmounts MapTab on tab change, so
 *  this runs once per visit: on mount view + fit the active scene and resume the
 *  render loop; on unmount pause it (and hide the board). */
export function useCanvasLifecycle(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await viewActiveScene();
      if (cancelled) return;
      resumeCanvas();
      fitActiveScene();
    })();
    return () => {
      cancelled = true;
      pauseCanvas();
    };
  }, []);
}
