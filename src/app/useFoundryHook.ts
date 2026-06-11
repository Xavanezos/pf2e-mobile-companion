import { useEffect } from "react";

/** Register a Foundry hook on mount, remove it on unmount. The backbone for
 *  later phases. Pass a stable `handler` (e.g. via useCallback) to avoid
 *  re-subscribing on every render. */
export function useFoundryHook(hookName: string, handler: (...args: any[]) => void): void {
  useEffect(() => {
    const id = Hooks.on(hookName as any, handler as any);
    return () => {
      Hooks.off(hookName as any, id as any);
    };
  }, [hookName, handler]);
}
