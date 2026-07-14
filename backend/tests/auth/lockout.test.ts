import { describe, expect, it } from "vitest";
import { computeLockedUntil, isLocked, LOCKOUT_THRESHOLD } from "../../src/auth/lockout.js";

describe("lockout progressivo", () => {
  it("non blocca sotto la soglia", () => {
    expect(computeLockedUntil(LOCKOUT_THRESHOLD - 1)).toBeNull();
  });

  it("blocca 1 minuto al raggiungimento della soglia", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const lockedUntil = computeLockedUntil(LOCKOUT_THRESHOLD, now);
    expect(lockedUntil).not.toBeNull();
    expect(lockedUntil!.getTime() - now.getTime()).toBe(60_000);
  });

  it("raddoppia il tempo di blocco ad ogni tentativo oltre la soglia", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const first = computeLockedUntil(LOCKOUT_THRESHOLD, now)!;
    const second = computeLockedUntil(LOCKOUT_THRESHOLD + 1, now)!;
    expect(second.getTime() - now.getTime()).toBe(2 * (first.getTime() - now.getTime()));
  });

  it("satura il backoff a 60 minuti", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const lockedUntil = computeLockedUntil(LOCKOUT_THRESHOLD + 20, now)!;
    expect(lockedUntil.getTime() - now.getTime()).toBe(60 * 60_000);
  });

  it("isLocked riflette correttamente scadenza passata/futura", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isLocked(new Date(now.getTime() + 1000), now)).toBe(true);
    expect(isLocked(new Date(now.getTime() - 1000), now)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});
