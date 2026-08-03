import { expect, test } from "bun:test";
import { clamp, MAX_MS, MIN_MS, parseDuration, rollDuration, untilISO } from "./duration";

test("parses each unit suffix", () => {
  expect(parseDuration("30s")).toBe(30_000);
  expect(parseDuration("5m")).toBe(300_000);
  expect(parseDuration("2h")).toBe(7_200_000);
  expect(parseDuration("7d")).toBe(604_800_000);
});

test("a bare number is read as seconds", () => {
  expect(parseDuration("90")).toBe(90_000);
});

test("tolerates whitespace and case", () => {
  expect(parseDuration("  10 M ")).toBe(600_000);
});

test("clamps above Discord's 28 day cap", () => {
  expect(parseDuration("99d")).toBe(MAX_MS);
});

test("clamps below one second", () => {
  expect(clamp(0)).toBe(MIN_MS);
  expect(clamp(-5)).toBe(MIN_MS);
  expect(clamp(NaN)).toBe(MIN_MS);
});

test("unparseable input falls back", () => {
  expect(parseDuration("banana", 5000)).toBe(5000);
  expect(parseDuration("", 5000)).toBe(5000);
  expect(parseDuration(undefined as any, 5000)).toBe(5000);
});

test("fixed mode uses the configured duration", () => {
  expect(rollDuration({ mode: "fixed", duration: "60s" })).toBe(60_000);
});

test("random mode spans the full legal window", () => {
  expect(rollDuration({ mode: "random" }, () => 0)).toBe(MIN_MS);
  expect(rollDuration({ mode: "random" }, () => 1)).toBe(MAX_MS);
  expect(rollDuration({ mode: "random" }, () => 0.5)).toBe(
    Math.floor(MIN_MS + 0.5 * (MAX_MS - MIN_MS)),
  );
});

test("random ignores any stored fixed duration", () => {
  expect(rollDuration({ mode: "random", duration: "1d" }, () => 0)).toBe(MIN_MS);
});

test("untilISO offsets from the given clock", () => {
  expect(untilISO(Date.parse("2026-01-01T00:00:00.000Z"), 60_000)).toBe(
    "2026-01-01T00:01:00.000Z",
  );
});
