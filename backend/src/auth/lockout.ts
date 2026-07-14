export const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_CAP_MINUTES = 60;

/** Backoff progressivo: 1, 2, 4, 8... minuti (cap 60) a partire dal tentativo fallito n. LOCKOUT_THRESHOLD. */
export function computeLockedUntil(failedAttempts: number, now: Date = new Date()): Date | null {
  if (failedAttempts < LOCKOUT_THRESHOLD) {
    return null;
  }
  const minutes = Math.min(2 ** (failedAttempts - LOCKOUT_THRESHOLD), LOCKOUT_CAP_MINUTES);
  return new Date(now.getTime() + minutes * 60_000);
}

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}
