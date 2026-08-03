export interface Schedule {
  at(key: string, delayMs: number, fn: () => void): void;
  cancel(key: string): void;
  clear(): void;
  size(): number;
}

// A keyed timer registry. Scheduling a key that already has a pending timer
// replaces it, so a rule can never accumulate duplicate re-apply timers (e.g.
// when a GUILD_MEMBER_UPDATE arrives for a timeout we just set ourselves).
// `clear()` on unload guarantees nothing fires after the plugin is disabled.
export function createSchedule(setTimer = setTimeout, clearTimer = clearTimeout): Schedule {
  const timers = new Map<string, any>();

  function cancel(key: string) {
    const id = timers.get(key);
    if (id !== undefined) {
      clearTimer(id);
      timers.delete(key);
    }
  }

  return {
    at(key, delayMs, fn) {
      cancel(key);
      // Timers far in the future overflow the 32-bit setTimeout delay and would
      // fire immediately; cap at ~24 days and let the next sweep pick up the
      // remainder. Negative/past delays run on the next tick.
      const MAX_DELAY = 2_147_483_647;
      const delay = Math.min(Math.max(delayMs, 0), MAX_DELAY);
      const id = setTimer(() => {
        timers.delete(key);
        fn();
      }, delay);
      timers.set(key, id);
    },
    cancel,
    clear() {
      timers.forEach(id => clearTimer(id));
      timers.clear();
    },
    size() {
      return timers.size;
    },
  };
}
