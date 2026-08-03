import { expect, test } from "bun:test";
import { findRule, findUserRule, matches, timerKey } from "./rules";

const rules = [
  { userId: "1", guildId: "100", mode: "fixed" as const, duration: "60s" },
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

test("findRule returns the rule with its per-user settings", () => {
  expect(findRule(rules, "1", "100")).toEqual(rules[0]);
});

test("findRule returns null when nothing matches", () => {
  expect(findRule(rules, "9", "100")).toBeNull();
  expect(findRule(undefined as any, "1", "100")).toBeNull();
});

test("findUserRule matches regardless of guild", () => {
  const userOnly = [{ userId: "7", mode: "random" as const }];
  expect(findUserRule(userOnly, "7")).toEqual(userOnly[0]);
  expect(findUserRule(userOnly, "8")).toBeNull();
  expect(findUserRule(undefined as any, "7")).toBeNull();
});

test("timerKey distinguishes users and guilds", () => {
  expect(timerKey("100", "1")).toBe("100:1");
  expect(timerKey("100", "1")).not.toBe(timerKey("200", "1"));
  expect(timerKey("100", "1")).not.toBe(timerKey("100", "2"));
});
