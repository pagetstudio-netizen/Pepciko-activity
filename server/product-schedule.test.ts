import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getActivityLaunchDisplay,
  isProductAvailableForCountry,
  isScheduledProductDisplayable,
  isValidLaunchSchedule,
} from "./product-schedule";

const scheduledActivity = {
  isActive: true,
  productType: "activity",
  launchDate: "2026-10-07",
  launchTime: "10:00",
};

test("activity launch is scheduled at the same GMT instant for all countries", () => {
  const beforeLaunch = new Date("2026-10-07T09:59:00Z");
  const atLaunch = new Date("2026-10-07T10:00:00Z");

  assert.equal(isProductAvailableForCountry(scheduledActivity, "TG", beforeLaunch), false);
  for (const country of ["TG", "CI", "BF", "BJ", "CM", "NE"]) {
    assert.equal(isProductAvailableForCountry(scheduledActivity, country, beforeLaunch), false);
    assert.equal(isProductAvailableForCountry(scheduledActivity, country, atLaunch), true);
  }
});

test("active future activity offers remain visible before purchase opens", () => {
  const beforeLaunch = new Date("2026-10-07T09:59:00Z");
  assert.equal(isScheduledProductDisplayable(scheduledActivity), true);
  assert.equal(isProductAvailableForCountry(scheduledActivity, "TG", beforeLaunch), false);
  assert.equal(isScheduledProductDisplayable({ ...scheduledActivity, isActive: false }), false);
  assert.equal(isScheduledProductDisplayable({ ...scheduledActivity, launchTime: null }), false);
});

test("a 16:00 GMT launch corresponds to 17:00 in Benin and Cameroon", () => {
  const schedule = { ...scheduledActivity, launchDate: "2026-11-25", launchTime: "16:00" };
  assert.equal(isProductAvailableForCountry(schedule, "TG", new Date("2026-11-25T15:59:00Z")), false);
  assert.equal(isProductAvailableForCountry(schedule, "BJ", new Date("2026-11-25T15:59:00Z")), false);
  assert.equal(isProductAvailableForCountry(schedule, "CM", new Date("2026-11-25T16:00:00Z")), true);
});

test("scheduled availability is displayed in the user's country-local clock", () => {
  const schedule = { ...scheduledActivity, launchDate: "2026-11-25", launchTime: "16:00" };
  assert.equal(getActivityLaunchDisplay(schedule, "TG")?.label, "25 novembre 2026 à 16:00 (GMT)");
  assert.equal(getActivityLaunchDisplay(schedule, "CI")?.timeLabel, "16:00");
  assert.equal(getActivityLaunchDisplay(schedule, "BJ")?.label, "25 novembre 2026 à 17:00 (GMT+1)");
  assert.equal(getActivityLaunchDisplay(schedule, "CM")?.timeLabel, "17:00");
  assert.equal(getActivityLaunchDisplay(schedule, "NE")?.timeZoneLabel, "GMT+1");
});

test("inactive, invalidly scheduled, and future products are not available", () => {
  assert.equal(isProductAvailableForCountry({ ...scheduledActivity, isActive: false }, "TG", new Date("2026-10-07T10:00:00Z")), false);
  assert.equal(isProductAvailableForCountry({ ...scheduledActivity, launchDate: null }, "TG", new Date("2026-10-07T10:00:00Z")), false);
  assert.equal(isProductAvailableForCountry(scheduledActivity, "TG", new Date("2026-10-06T10:00:00Z")), false);
  assert.equal(isValidLaunchSchedule("2026-02-30", "10:00"), false);
  assert.equal(isValidLaunchSchedule("2026-10-07", "24:00"), false);
});

test("stable products are not delayed by an activity launch schedule", () => {
  assert.equal(isProductAvailableForCountry({
    ...scheduledActivity,
    productType: "stable",
    launchDate: null,
    launchTime: null,
  }, "TG", new Date("2026-10-01T00:00:00Z")), true);
});
