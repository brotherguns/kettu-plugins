export interface Rule {
  userId: string;
  guildId: string;
}

export function matches(rules: Rule[], userId: string, guildId: string): boolean {
  if (!userId || !guildId) return false;
  return rules.some(r => r.userId === userId && r.guildId === guildId);
}
