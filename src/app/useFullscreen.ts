import { useCallback, useEffect, useState } from "react";

export function useFullscreen(): { isFullscreen: boolean; toggle: () => void } {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => document.fullscreenElement != null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch((e) => {
        console.warn("pf2e-mobile-companion | fullscreen request rejected", e);
      });
    }
  }, []);

  return { isFullscreen, toggle };
}
