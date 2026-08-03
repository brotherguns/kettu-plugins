export interface Rule {
  userId: string;
  // AutoDelete/AutoKick scope each rule to one guild. AutoTimeout does not:
  // its rules name a user only and apply wherever the permission exists.
  guildId?: string;
  // AutoTimeout only.
  mode?: "fixed" | "random";
  duration?: string;
}

export function matches(rules: Rule[], userId: string, guildId: string): boolean {
  return findRule(rules, userId, guildId) !== null;
}

// Returns the matching rule itself, which callers need when the rule carries
// per-user settings (AutoTimeout's mode/duration) rather than just membership.
export function findRule(rules: Rule[], userId: string, guildId: string): Rule | null {
  if (!userId || !guildId || !rules) return null;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].userId === userId && rules[i].guildId === guildId) return rules[i];
  }
  return null;
}

// Guild-agnostic lookup, for rules that apply everywhere.
export function findUserRule(rules: Rule[], userId: string): Rule | null {
  if (!userId || !rules) return null;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].userId === userId) return rules[i];
  }
  return null;
}

// Stable identity for one (guild, user) pair, used to key re-apply timers.
export function timerKey(guildId: string, userId: string): string {
  return guildId + ":" + userId;
}
