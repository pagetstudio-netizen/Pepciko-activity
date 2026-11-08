import assert from "node:assert/strict";
import test from "node:test";
import { blogApprovalSchema } from "@shared/schema";
import {
  BLOG_DAILY_LIMIT_MESSAGE,
  BLOG_IMAGE_REQUIRED_MESSAGE,
  getBlogLocalDayWindow,
  isSuccessfulBlogWithdrawalStatus,
} from "./blog-policy";

test("only approved withdrawals qualify for publishing a blog post", () => {
  assert.equal(isSuccessfulBlogWithdrawalStatus("approved"), true);
  assert.equal(isSuccessfulBlogWithdrawalStatus("pending"), false);
  assert.equal(isSuccessfulBlogWithdrawalStatus("processing"), false);
  assert.equal(isSuccessfulBlogWithdrawalStatus("rejected"), false);
});

test("blog submission limit follows the member's local calendar day", () => {
  const togoWindow = getBlogLocalDayWindow(new Date("2026-11-05T12:00:00.000Z"), "TG");
  assert.equal(togoWindow.dayKey, "2026-11-05");
  assert.equal(togoWindow.start.toISOString(), "2026-11-05T00:00:00.000Z");
  assert.equal(togoWindow.end.toISOString(), "2026-11-06T00:00:00.000Z");
});

test("blog submission day bounds respect Cameroon local midnight", () => {
  const cameroonWindow = getBlogLocalDayWindow(new Date("2026-11-04T23:30:00.000Z"), "CM");
  assert.equal(cameroonWindow.dayKey, "2026-11-05");
  assert.equal(cameroonWindow.start.toISOString(), "2026-11-04T23:00:00.000Z");
  assert.equal(cameroonWindow.end.toISOString(), "2026-11-05T23:00:00.000Z");
});

test("blog policy exposes localized daily and image-required messages", () => {
  assert.match(BLOG_DAILY_LIMIT_MESSAGE, /aujourd’hui/);
  assert.match(BLOG_IMAGE_REQUIRED_MESSAGE, /capture d’écran/);
});

test("blog approval accepts only positive whole FCFA rewards", () => {
  assert.equal(blogApprovalSchema.safeParse({ rewardAmount: "250" }).success, true);
  assert.equal(blogApprovalSchema.safeParse({ rewardAmount: "0" }).success, false);
  assert.equal(blogApprovalSchema.safeParse({ rewardAmount: "10.5" }).success, false);
  assert.equal(blogApprovalSchema.safeParse({ rewardAmount: "-1" }).success, false);
});
