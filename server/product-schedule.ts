import type { ProductType } from "@shared/schema";

export type ScheduledProduct = {
  isActive: boolean;
  productType: ProductType | string;
  launchDate: string | null;
  launchTime: string | null;
};

const ACTIVITY_LAUNCH_TIME_ZONES: Record<string, { timeZone: string; label: string }> = {
  TG: { timeZone: "Africa/Lome", label: "GMT" },
  BF: { timeZone: "Africa/Ouagadougou", label: "GMT" },
  CI: { timeZone: "Africa/Abidjan", label: "GMT" },
  BJ: { timeZone: "Africa/Porto-Novo", label: "GMT+1" },
  CM: { timeZone: "Africa/Douala", label: "GMT+1" },
  NE: { timeZone: "Africa/Niamey", label: "GMT+1" },
};

export function isValidLaunchSchedule(date: unknown, time: unknown): date is string {
  if (typeof date !== "string" || typeof time !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function isScheduledProductDisplayable(product: ScheduledProduct): boolean {
  if (!product.isActive) return false;
  return product.productType !== "activity"
    || isValidLaunchSchedule(product.launchDate, product.launchTime);
}

export function getActivityLaunchDisplay(
  product: ScheduledProduct,
  countryCode: string,
): { dateLabel: string; timeLabel: string; timeZoneLabel: string; label: string } | null {
  if (product.productType !== "activity" || !isValidLaunchSchedule(product.launchDate, product.launchTime)) {
    return null;
  }

  const [year, month, day] = product.launchDate!.split("-").map(Number);
  const [hours, minutes] = product.launchTime!.split(":").map(Number);
  const scheduledAt = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const zone = ACTIVITY_LAUNCH_TIME_ZONES[countryCode.toUpperCase()] ?? {
    timeZone: "UTC",
    label: "GMT",
  };
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: zone.timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(scheduledAt);
  const timeLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: zone.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(scheduledAt);

  return {
    dateLabel,
    timeLabel,
    timeZoneLabel: zone.label,
    label: `${dateLabel} à ${timeLabel} (${zone.label})`,
  };
}

export function isProductAvailableForCountry(
  product: ScheduledProduct,
  _countryCode: string,
  now = new Date(),
): boolean {
  if (!product.isActive) return false;
  if (product.productType !== "activity") return true;
  if (!isValidLaunchSchedule(product.launchDate, product.launchTime)) return false;

  const [year, month, day] = product.launchDate!.split("-").map(Number);
  const [hours, minutes] = product.launchTime!.split(":").map(Number);
  const scheduledAt = Date.UTC(year, month - 1, day, hours, minutes);
  return now.getTime() >= scheduledAt;
}
