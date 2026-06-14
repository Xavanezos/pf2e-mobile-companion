import { useCallback, useEffect, useRef, useState } from "react";

/** Coalesce a burst of refresh requests into a single re-render. `requestRefresh`
 *  schedules one animation frame that bumps the version; further calls before that
 *  frame fires fold into it. Aligns updates to paint and goes quiet when the tab is
 *  hidden — useful when the GM moves many tokens at once. */
export function useBatchedRefresh(): [number, () => void] {
  const [version, setVersion] = useState(0);
  const frame = useRef<number | null>(null);

  const requestRefresh = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setVersion((n) => n + 1);
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return [version, requestRefresh];
}
