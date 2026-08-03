import { expect, test } from "bun:test";
import { createSchedule } from "./schedule";

// A controllable fake clock so tests never actually wait.
function fakeTimers() {
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let now = 0;
  return {
    setTimer(fn: () => void, delay: number) {
      const id = nextId++;
      pending.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimer(id: number) {
      pending.delete(id);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(id);
          t.fn();
        }
      }
    },
    pendingCount: () => pending.size,
  };
}

test("fires the callback after the delay", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  let fired = 0;
  s.at("a", 1000, () => fired++);

  clock.advance(999);
  expect(fired).toBe(0);
  clock.advance(1);
  expect(fired).toBe(1);
});

test("rescheduling a key replaces the pending timer", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  const fired: string[] = [];
  s.at("a", 1000, () => fired.push("first"));
  s.at("a", 2000, () => fired.push("second"));

  expect(s.size()).toBe(1);
  clock.advance(5000);
  expect(fired).toEqual(["second"]);
});

test("distinct keys run independently", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  const fired: string[] = [];
  s.at("a", 100, () => fired.push("a"));
  s.at("b", 200, () => fired.push("b"));

  clock.advance(200);
  expect(fired).toEqual(["a", "b"]);
});

test("clear cancels everything and nothing fires afterwards", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  let fired = 0;
  s.at("a", 100, () => fired++);
  s.at("b", 100, () => fired++);
  s.clear();

  expect(s.size()).toBe(0);
  clock.advance(1000);
  expect(fired).toBe(0);
});

test("a fired timer stops occupying its key", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  s.at("a", 100, () => {});
  clock.advance(100);
  expect(s.size()).toBe(0);
});

test("delays beyond the 32-bit limit are capped, not wrapped", () => {
  const clock = fakeTimers();
  const s = createSchedule(clock.setTimer as any, clock.clearTimer as any);
  let fired = 0;
  s.at("a", 28 * 24 * 60 * 60 * 1000, () => fired++);

  clock.advance(2_147_483_646);
  expect(fired).toBe(0);
  clock.advance(1);
  expect(fired).toBe(1);
});
