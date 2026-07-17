export interface Queue {
  push(task: () => Promise<unknown>): void;
  clear(): void;
  size(): number;
}

export function createQueue(
  opts: { delayMs?: number; onError?: (e: unknown) => void } = {},
): Queue {
  const delayMs = opts.delayMs ?? 750;
  const onError = opts.onError ?? (() => {});
  let pending: Array<() => Promise<unknown>> = [];
  let running = false;

  async function drain() {
    if (running) return;
    running = true;
    while (pending.length) {
      const task = pending.shift()!;
      try {
        await task();
      } catch (e) {
        onError(e);
      }
      if (pending.length && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    running = false;
  }

  return {
    push(task) {
      pending.push(task);
      void drain();
    },
    clear() {
      pending = [];
    },
    size() {
      return pending.length;
    },
  };
}
