export function hpClamped(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function hpAfterHeal(current: number, max: number, amount: number): number {
  return hpClamped(current + Math.max(0, amount), max);
}

/** Numpad input → non-negative integer (0 on garbage). */
export function parseAmount(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
