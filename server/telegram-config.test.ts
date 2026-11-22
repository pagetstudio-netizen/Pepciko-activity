import assert from "node:assert/strict";
import test from "node:test";
import { resolveTelegramChatId } from "./telegram";

test("Telegram notifications prefer the existing RAMCHAT_ID group", () => {
  assert.equal(resolveTelegramChatId("-100123", "-100456"), "-100123");
});

test("Telegram notifications fall back to TELEGRAM_CHAT_ID", () => {
  assert.equal(resolveTelegramChatId(" ", "-100456"), "-100456");
});

test("Telegram chat ID resolution trims whitespace and rejects empty values", () => {
  assert.equal(resolveTelegramChatId("  -100123  ", undefined), "-100123");
  assert.equal(resolveTelegramChatId(undefined, " "), "");
});
