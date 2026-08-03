export interface Rule {
  userId: string;
  guildId: string;
  // AutoTimeout only. Absent on AutoDelete/AutoKick rules, which ignore them.
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

// Stable identity for a rule, used to key scheduled re-apply timers.
export function ruleKey(rule: Rule): string {
  return rule.guildId + ":" + rule.userId;
}
