import type { ProductType } from "@shared/schema";

export type ScheduledProduct = {
  isActive: boolean;
  productType: ProductType | string;
  launchDate: string | null;
  launchTime: string | null;
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
