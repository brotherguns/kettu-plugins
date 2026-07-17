import { expect, test } from "bun:test";
import { matches } from "./rules";

const rules = [
  { userId: "1", guildId: "100" },
  { userId: "2", guildId: "200" },
];

test("matches an exact user+guild pair", () => {
  expect(matches(rules, "1", "100")).toBe(true);
});

test("does not match right user in wrong guild", () => {
  expect(matches(rules, "1", "200")).toBe(false);
});

test("does not match unknown user", () => {
  expect(matches(rules, "9", "100")).toBe(false);
});

test("empty rules never match", () => {
  expect(matches([], "1", "100")).toBe(false);
});

test("ignores undefined ids safely", () => {
  expect(matches(rules, undefined as any, "100")).toBe(false);
});
