export const DAILY_CHECKIN_REWARDS_BY_VIP_LEVEL = [
  45,
  60,
  75,
  90,
  105,
  120,
  135,
  150,
] as const;
export const DAILY_CHECKIN_REWARD = DAILY_CHECKIN_REWARDS_BY_VIP_LEVEL[0];
export const DAILY_CHECKIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function getDailyCheckinRewardForVip(vipLevel: number): number {
  const safeLevel = Number.isSafeInteger(vipLevel) ? vipLevel : 0;
  const boundedLevel = Math.max(1, Math.min(safeLevel, DAILY_CHECKIN_REWARDS_BY_VIP_LEVEL.length));
  return DAILY_CHECKIN_REWARDS_BY_VIP_LEVEL[boundedLevel - 1];
}

const DAILY_CHECKIN_TIMEZONES: Record<string, string> = {
  TG: "Africa/Lome",
  BF: "Africa/Ouagadougou",
  CI: "Africa/Abidjan",
  BJ: "Africa/Porto-Novo",
  CM: "Africa/Douala",
  NE: "Africa/Niamey",
};

export function getDailyCheckinTimeZone(countryCode: string): string {
  return DAILY_CHECKIN_TIMEZONES[countryCode.toUpperCase()] || "Africa/Lome";
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function dateOrdinal(value: string): number | null {
  if (!isDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return Math.floor(date.getTime() / DAILY_CHECKIN_COOLDOWN_MS);
}

export function getDailyCheckinDateKey(date: Date, countryCode: string): string {
  const timeZone = getDailyCheckinTimeZone(countryCode);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getDailyCheckinCooldownUntil(lastClaimAt: Date | null, now: Date): Date | null {
  if (!lastClaimAt) return null;
  const nextClaimAt = new Date(lastClaimAt.getTime() + DAILY_CHECKIN_COOLDOWN_MS);
  return nextClaimAt > now ? nextClaimAt : null;
}

export function daysBetweenCheckinDates(from: string, to: string): number | null {
  const fromOrdinal = dateOrdinal(from);
  const toOrdinal = dateOrdinal(to);
  if (fromOrdinal === null || toOrdinal === null) return null;
  return toOrdinal - fromOrdinal;
}

function uniqueRecentDates(claimDates: string[]): string[] {
  return Array.from(new Set(claimDates.filter((date) => dateOrdinal(date) !== null)))
    .sort((a, b) => b.localeCompare(a));
}

export function calculateDailyCheckinStreak(claimDates: string[], today: string): number {
  const dates = uniqueRecentDates(claimDates);
  if (!dates.length) return 0;

  const age = daysBetweenCheckinDates(dates[0], today);
  if (age === null || age < 0 || age > 1) return 0;

  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (daysBetweenCheckinDates(dates[index], dates[index - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}

export function calculateDailyCheckinStreakAfterClaim(
  claimDates: string[],
  claimDate: string,
): number {
  const dates = uniqueRecentDates(claimDates);
  if (!dates.length || daysBetweenCheckinDates(dates[0], claimDate) !== 1) return 1;
  return calculateDailyCheckinStreak(dates, dates[0]) + 1;
}
