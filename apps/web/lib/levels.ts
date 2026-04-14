export interface LevelThreshold {
  level: number;
  title: string;
  xp: number;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, title: 'Rookie Creator', xp: 0 },
  { level: 2, title: 'Rising Dev', xp: 500 },
  { level: 3, title: 'Game Builder', xp: 1_500 },
  { level: 4, title: 'Studio Founder', xp: 3_000 },
  { level: 5, title: 'DevEx Earner', xp: 5_000 },
  { level: 6, title: 'Top Creator', xp: 10_000 },
  { level: 7, title: 'Elite Developer', xp: 20_000 },
  { level: 8, title: 'Legendary Studio', xp: 50_000 },
];

export function getLevelForXP(xp: number): {
  level: number;
  title: string;
  currentXP: number;
  nextLevelXP: number;
  prevLevelXP: number;
  progress: number;
} {
  let current = LEVEL_THRESHOLDS[0];
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xp) current = threshold;
    else break;
  }

  const idx = LEVEL_THRESHOLDS.findIndex((t) => t.level === current.level);
  const next = LEVEL_THRESHOLDS[idx + 1] ?? null;
  const prevXP = current.xp;
  const nextXP = next ? next.xp : current.xp;
  const progress = next ? ((xp - prevXP) / (nextXP - prevXP)) * 100 : 100;

  return {
    level: current.level,
    title: current.title,
    currentXP: xp,
    nextLevelXP: nextXP,
    prevLevelXP: prevXP,
    progress: Math.min(100, Math.max(0, progress)),
  };
}

export const XP_REWARDS = {
  connect_game: 500,
  first_agent_run: 200,
  agent_run: 50,
  first_pricing_test: 300,
  first_devex: 500,
  upgrade_creator: 1000,
  upgrade_pro: 2000,
  refer_creator: 500,
  seven_day_streak: 250,
  first_tweet: 150,
} as const;
