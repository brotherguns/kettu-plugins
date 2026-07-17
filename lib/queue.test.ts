import { expect, test } from "bun:test";
import { createQueue } from "./queue";

const flush = () => new Promise(r => setTimeout(r, 50));

test("runs tasks sequentially in FIFO order", async () => {
  const order: number[] = [];
  const q = createQueue({ delayMs: 0 });
  q.push(async () => { order.push(1); });
  q.push(async () => { order.push(2); });
  q.push(async () => { order.push(3); });
  await flush();
  expect(order).toEqual([1, 2, 3]);
});

test("a rejecting task is reported and does not halt the queue", async () => {
  const errors: unknown[] = [];
  const order: number[] = [];
  const q = createQueue({ delayMs: 0, onError: e => errors.push(e) });
  q.push(async () => { throw new Error("boom"); });
  q.push(async () => { order.push(2); });
  await flush();
  expect(errors.length).toBe(1);
  expect(order).toEqual([2]);
});

test("clear() drops pending tasks", async () => {
  const order: number[] = [];
  const q = createQueue({ delayMs: 10 });
  q.push(async () => { order.push(1); });
  q.push(async () => { order.push(2); });
  q.clear();
  await flush();
  expect(order).toEqual([1]);
});
