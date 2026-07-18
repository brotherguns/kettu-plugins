export interface Queue {
  push(task: () => Promise<unknown> | unknown): void;
  clear(): void;
  size(): number;
}

// A sequential, throttled task queue. Tasks run one at a time in FIFO order
// with `delayMs` between them; a rejected/throwing task is reported via
// `onError` and does not halt the queue. Implemented with plain Promises (no
// async/await) so the bundle stays parseable by older Hermes builds.
export function createQueue(
  opts: { delayMs?: number; onError?: (e: unknown) => void } = {},
): Queue {
  const delayMs = opts.delayMs ?? 750;
  const onError = opts.onError ?? (() => {});
  let pending: Array<() => Promise<unknown> | unknown> = [];
  let running = false;

  function scheduleNext() {
    if (pending.length && delayMs > 0) {
      setTimeout(runNext, delayMs);
    } else {
      runNext();
    }
  }

  function runNext() {
    if (!pending.length) {
      running = false;
      return;
    }
    const task = pending.shift()!;
    let p: Promise<unknown>;
    try {
      p = Promise.resolve(task());
    } catch (e) {
      onError(e);
      p = Promise.resolve();
    }
    p.then(scheduleNext, (e) => {
      onError(e);
      scheduleNext();
    });
  }

  function drain() {
    if (running) return;
    running = true;
    runNext();
  }

  return {
    push(task) {
      pending.push(task);
      drain();
    },
    clear() {
      pending = [];
    },
    size() {
      return pending.length;
    },
  };
}
