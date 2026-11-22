import {
  getDailyCheckinDateKey,
  getDailyCheckinTimeZone,
} from "@shared/daily-checkin";

export const BLOG_SUCCESSFUL_WITHDRAWAL_STATUS = "approved";

export const BLOG_WITHDRAWAL_REQUIRED_MESSAGE =
  "Vous devez effectuer un retrait réussi pour envoyer votre commentaire.";

export const BLOG_DAILY_LIMIT_MESSAGE =
  "Vous avez déjà envoyé une publication aujourd’hui. Vous pourrez en envoyer une autre demain.";

export const BLOG_IMAGE_REQUIRED_MESSAGE =
  "Ajoutez au moins une capture d’écran avant d’envoyer votre publication.";

export function countsAsBlogSubmission(isPublished: boolean, status: string): boolean {
  return isPublished && (status === "pending" || status === "approved");
}

export function isSuccessfulBlogWithdrawalStatus(status: string): boolean {
  return status === BLOG_SUCCESSFUL_WITHDRAWAL_STATUS;
}

function getLocalMidnight(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(wallClockUtc));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const representedLocalTimeUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return new Date(wallClockUtc - (representedLocalTimeUtc - wallClockUtc));
}

export function getBlogLocalDayWindow(now: Date, countryCode: string): {
  dayKey: string;
  start: Date;
  end: Date;
} {
  const timeZone = getDailyCheckinTimeZone(countryCode);
  const dayKey = getDailyCheckinDateKey(now, countryCode);
  const [year, month, day] = dayKey.split("-").map(Number);
  const nextDayKey = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);

  return {
    dayKey,
    start: getLocalMidnight(dayKey, timeZone),
    end: getLocalMidnight(nextDayKey, timeZone),
  };
}
