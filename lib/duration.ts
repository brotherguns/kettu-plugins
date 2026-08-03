// Duration parsing and rolling for AutoTimeout.
//
// Discord's `communication_disabled_until` accepts at most 28 days ahead; the
// shortest useful timeout is 1 second. Every value produced here is clamped to
// that window, so a malformed setting can never send an out-of-range PATCH.

export const MIN_MS = 1000;
export const MAX_MS = 28 * 24 * 60 * 60 * 1000; // 28 days, Discord's hard cap

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function clamp(ms: number): number {
  if (!(ms > 0)) return MIN_MS; // also catches NaN
  if (ms < MIN_MS) return MIN_MS;
  if (ms > MAX_MS) return MAX_MS;
  return Math.floor(ms);
}

// Parses "30s" / "5m" / "2h" / "7d" (and a bare number, read as seconds).
// Anything unparseable falls back to `fallback`, already clamped.
export function parseDuration(input: string, fallback = 60 * 1000): number {
  if (typeof input !== "string") return clamp(fallback);
  const text = input.trim().toLowerCase();
  if (!text) return clamp(fallback);

  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/.exec(text);
  if (!m) return clamp(fallback);

  const value = parseFloat(m[1]);
  const unit = m[2] ? UNIT_MS[m[2]] : UNIT_MS.s;
  return clamp(value * unit);
}

export interface DurationSpec {
  mode?: "fixed" | "random";
  duration?: string;
}

// Rolls the duration for one application. Random mode picks uniformly across
// the whole legal window (1s .. 28d) on every call, so repeated re-applies to
// the same user each get a fresh value. `rng` is injectable for tests.
export function rollDuration(spec: DurationSpec, rng: () => number = Math.random): number {
  if (spec && spec.mode === "random") {
    return clamp(MIN_MS + rng() * (MAX_MS - MIN_MS));
  }
  return parseDuration(spec && spec.duration ? spec.duration : "");
}

// The ISO timestamp to send as `communication_disabled_until`.
export function untilISO(nowMs: number, durationMs: number): string {
  return new Date(nowMs + clamp(durationMs)).toISOString();
}
