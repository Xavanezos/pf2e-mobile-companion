/** Localize a PF2e i18n key, falling back to the raw string when it isn't a key
 *  (or i18n isn't reachable). `getSheetData()` returns some spell group labels
 *  (cantrips, focus) as raw keys and others (numbered ranks) already localized —
 *  `localize()` returns a non-key string unchanged, so this is safe for both. */
export function loc(s: string): string {
  try {
    return (game as any)?.i18n?.localize?.(s) ?? s;
  } catch {
    return s;
  }
}
