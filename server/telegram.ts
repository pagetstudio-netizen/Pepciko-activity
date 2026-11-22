const TELEGRAM_API = "https://api.telegram.org";
import { storage } from "./storage";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function sendTelegramMessageToChat(message: string, chatId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  await sendTelegramMessageToChat(message, chatId);
}

export type DepositSupportReport = {
  userId: number;
  referralCode: string;
  userName: string;
  userPhone: string;
  deposit: {
    id: number;
    amount: number;
    status: string;
    paymentMethod: string;
    channelName?: string | null;
    country: string;
    reference?: string | null;
    createdAt: Date | string;
  };
  payerName: string;
  description: string;
};

export type DepositSupportReportImage = {
  buffer: Buffer;
  mimetype: string;
};

function buildDepositSupportReportMessage(data: DepositSupportReport): string {
  const createdAt = new Date(data.deposit.createdAt);
  const timestamp = Number.isNaN(createdAt.getTime())
    ? "—"
    : createdAt.toLocaleString("fr-FR", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  return [
    "🆘 <b>Signalement — dépôt non reçu</b>",
    `Ordre de dépôt : <b>#${formatTelegramValue(data.deposit.id)}</b>`,
    `Montant : <b>${formatTelegramValue(data.deposit.amount)} FCFA</b>`,
    `Statut actuel : ${formatTelegramValue(data.deposit.status)}`,
    `Moyen de paiement : ${formatTelegramValue(data.deposit.channelName || data.deposit.paymentMethod)}`,
    `Pays : ${formatTelegramValue(data.deposit.country)}`,
    data.deposit.reference ? `Référence : <code>${formatTelegramValue(data.deposit.reference)}</code>` : "",
    `Date de l'ordre (UTC) : ${formatTelegramValue(timestamp)}`,
    "",
    "<b>Compte utilisateur</b>",
    `Nom : ${formatTelegramValue(data.userName)}`,
    `Téléphone : <code>${formatTelegramValue(data.userPhone)}</code>`,
    `Identifiant interne : <code>${formatTelegramValue(data.userId)}</code>`,
    `Code de parrainage : <code>${formatTelegramValue(data.referralCode)}</code>`,
    "",
    `Nom du payeur : ${formatTelegramValue(data.payerName)}`,
    `Description :\n${formatTelegramValue(data.description)}`,
  ].filter(Boolean).join("\n");
}

async function sendTelegramReportPhotos(
  photos: DepositSupportReportImage[],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram n'est pas configuré");

  const method = photos.length === 1 ? "sendPhoto" : "sendMediaGroup";
  const formData = new FormData();
  formData.set("chat_id", chatId);
  if (photos.length === 1) {
    const photo = photos[0];
    formData.set("photo", new Blob([new Uint8Array(photo.buffer)], { type: photo.mimetype }), "preuve.jpg");
  } else {
    const media = photos.map((photo, index) => ({
      type: "photo",
      media: `attach://proof${index}`,
    }));
    formData.set("media", JSON.stringify(media));
    photos.forEach((photo, index) => {
      formData.set(
        `proof${index}`,
        new Blob([new Uint8Array(photo.buffer)], { type: photo.mimetype }),
        `preuve-${index + 1}.jpg`,
      );
    });
  }

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    body: formData,
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || result?.ok === false) {
    throw new Error(`Telegram ${method} HTTP ${response.status}${result?.description ? `: ${result.description}` : ""}`);
  }
}

/**
 * Sends the complete report to the same admin group as the existing Telegram bot.
 * Returns false only when the text reached the group but Telegram rejected the photos.
 */
export async function sendTelegramDepositSupportReport(
  data: DepositSupportReport,
  photos: DepositSupportReportImage[],
): Promise<boolean> {
  if (!isTelegramConfigured()) {
    throw new Error("Le bot Telegram ou le groupe administrateur n'est pas configuré");
  }

  await sendTelegramMessage(buildDepositSupportReportMessage(data));
  if (photos.length === 0) return true;

  try {
    await sendTelegramReportPhotos(photos);
    return true;
  } catch (error) {
    console.error("[telegram] deposit report delivered without its image attachments:", error);
    return false;
  }
}

export function formatTelegramValue(value: unknown): string {
  return escapeHtml(value);
}

export type RobotPayErrorNotification = {
  provider?: unknown;
  operation?: unknown;
  path: string;
  method: string;
  status: number;
  error: unknown;
  userId?: unknown;
  amount?: unknown;
  country?: unknown;
  operator?: unknown;
  reference?: unknown;
  recordId?: unknown;
};

function redactPaymentError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value || "Erreur inconnue");
  return raw
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [masqué]")
    .replace(/\b(?:dp_(?:live|sandbox)_sk_|sk_(?:live|test)_)[A-Za-z0-9_-]+/gi, "[clé masquée]")
    .replace(/\b(api[_ -]?key|secret|token|password|authorization)\s*[:=]\s*["']?[^,\s"'<>]+/gi, "$1=[masqué]")
    .replace(/([?&](?:api[_-]?key|token|secret|signature|sign|authorization)=)[^&\s]+/gi, "$1[masqué]")
    .replace(/\b(otp|code otp|code de vérification|verification code)\s*[:=]?\s*["']?\d{4,10}\b/gi, "$1=[masqué]")
    .replace(/\b(phone|telephone|mobile|account_number|num[eé]ro(?: de téléphone)?|téléphone)\s*[:=]?\s*["']?\+?[\d][\d\s().-]{6,20}/gi, "$1=[numéro masqué]")
    .slice(0, 1500);
}

export function buildRobotPayErrorNotification(data: RobotPayErrorNotification): string {
  return [
    `❌ <b>Erreur de paiement — ${formatTelegramValue(data.provider || "Paiement")}</b>`,
    data.operation ? `Action : ${formatTelegramValue(data.operation)}` : "",
    `Endpoint : <code>${formatTelegramValue(data.method)} ${formatTelegramValue(data.path)}</code>`,
    `Statut HTTP : <b>${formatTelegramValue(data.status)}</b>`,
    data.userId !== undefined ? `Utilisateur ID : <code>${formatTelegramValue(data.userId)}</code>` : "",
    data.amount !== undefined ? `Montant : <b>${formatTelegramValue(data.amount)} XOF</b>` : "",
    data.country ? `Pays : ${formatTelegramValue(data.country)}` : "",
    data.operator ? `Opérateur : ${formatTelegramValue(data.operator)}` : "",
    data.recordId !== undefined ? `ID opération : <code>${formatTelegramValue(data.recordId)}</code>` : "",
    data.reference ? `Référence : <code>${formatTelegramValue(data.reference)}</code>` : "",
    `Erreur réelle : <code>${formatTelegramValue(redactPaymentError(data.error))}</code>`,
  ].filter(Boolean).join("\n");
}

export async function sendTelegramPaymentError(data: RobotPayErrorNotification): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) {
    throw new Error("Le bot Telegram ou le groupe Telegram n'est pas configuré");
  }
  await sendTelegramMessageToChat(buildRobotPayErrorNotification(data), chatId);
}

export type ManualDepositNotification = {
  depositId: number;
  userId: number;
  userName: string;
  userPhone: string;
  payerPhone: string;
  amount: number;
  currency: string;
  country: string;
  operator: string;
  paymentType: "numéro" | "lien";
  paymentDestination: string;
  recipientName?: string | null;
  paymentNumberId: number;
  reference?: string | null;
  paymentMessage?: string | null;
  createdAt: Date | string;
};

export function buildManualDepositNotification(data: ManualDepositNotification): string {
  const createdAt = new Date(data.createdAt);
  const timestamp = Number.isNaN(createdAt.getTime()) ? "—" : createdAt.toISOString();
  return [
    "💳 <b>Nouveau paiement manuel à vérifier — RobotPay</b>",
    `Dépôt : <b>#${formatTelegramValue(data.depositId)}</b> — En attente`,
    `Utilisateur : ${formatTelegramValue(data.userName)} (ID ${formatTelegramValue(data.userId)})`,
    `Téléphone du compte : <code>${formatTelegramValue(data.userPhone)}</code>`,
    `Téléphone payeur : <code>${formatTelegramValue(data.payerPhone)}</code>`,
    `Montant : <b>${formatTelegramValue(data.amount)} ${formatTelegramValue(data.currency)}</b>`,
    `Pays : ${formatTelegramValue(data.country)}`,
    `Opérateur : ${formatTelegramValue(data.operator)}`,
    `Type de paiement : ${formatTelegramValue(data.paymentType)}`,
    `Compte destinataire : ${formatTelegramValue(data.recipientName || "—")}`,
    `ID du moyen de paiement : ${formatTelegramValue(data.paymentNumberId)}`,
    `Numéro/lien destinataire : <code>${formatTelegramValue(data.paymentDestination)}</code>`,
    data.reference ? `Référence du paiement : <code>${formatTelegramValue(data.reference)}</code>` : "",
    data.paymentMessage
      ? `Message reçu :\n<pre>${formatTelegramValue(data.paymentMessage)}</pre>`
      : "",
    `Créé (UTC) : <code>${formatTelegramValue(timestamp)}</code>`,
  ].filter(Boolean).join("\n");
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; description?: string; result?: any } | null;
  if (!response.ok || result?.ok === false) {
    const description = result?.description ? `: ${result.description}` : "";
    throw new Error(`Telegram ${method} HTTP ${response.status}${description}`);
  }
  return result;
}

async function handleTelegramCommand(text: string, chatId: string) {
  const command = text.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
  if (command === "/help" || command === "/start") {
    return [
      "🤖 <b>Commandes PepsiCo</b>",
      "/stats — statistiques de la plateforme",
      "/solde — soldes et montants en attente",
      "/pending — dépôts et retraits en attente",
      "/help — afficher cette aide",
    ].join("\n");
  }
  if (command === "/stats") {
    const stats = await storage.getStats();
    return [
      "📊 <b>Statistiques</b>",
      `Utilisateurs : ${formatTelegramValue(stats.totalUsers)}`,
      `Nouveaux aujourd'hui : ${formatTelegramValue(stats.todayUsers)}`,
      `Utilisateurs avec produit : ${formatTelegramValue(stats.usersWithProducts)}`,
      `Dépôts approuvés : ${formatTelegramValue(stats.totalDeposits)} XOF`,
      `Retraits approuvés : ${formatTelegramValue(stats.totalWithdrawals)} XOF`,
    ].join("\n");
  }
  if (command === "/solde") {
    const stats = await storage.getStats();
    return [
      "💰 <b>État des montants</b>",
      `Dépôts en attente : ${formatTelegramValue(stats.pendingDeposits)} (${formatTelegramValue(stats.pendingDepositsCount)})`,
      `Retraits en attente : ${formatTelegramValue(stats.pendingWithdrawals)} (${formatTelegramValue(stats.pendingWithdrawalsCount)})`,
    ].join("\n");
  }
  if (command === "/pending") {
    const [deposits, withdrawals] = await Promise.all([
      storage.getDeposits("pending"),
      storage.getWithdrawals("pending"),
    ]);
    const depositLines = deposits.slice(0, 10).map((item) =>
      `• Dépôt #${item.id} — ${item.amount} XOF — ${item.user?.fullName || "Utilisateur"}`,
    );
    const withdrawalLines = withdrawals.slice(0, 10).map((item) =>
      `• Retrait #${item.id} — ${item.amount} XOF — ${item.user?.fullName || "Utilisateur"}`,
    );
    return [
      "⏳ <b>Opérations en attente</b>",
      "<b>Dépôts</b>",
      ...(depositLines.length ? depositLines : ["Aucun dépôt en attente"]),
      "<b>Retraits</b>",
      ...(withdrawalLines.length ? withdrawalLines : ["Aucun retrait en attente"]),
    ].join("\n");
  }
  return "Commande inconnue. Utilise /help.";
}

export async function sendDailyTelegramSummary(): Promise<void> {
  if (!isTelegramConfigured()) return;
  const stats = await storage.getStats();
  await sendTelegramMessage([
    "📋 <b>Résumé détaillé de la plateforme</b>",
    `Utilisateurs : ${formatTelegramValue(stats.totalUsers)}`,
    `Nouveaux utilisateurs : ${formatTelegramValue(stats.todayUsers)}`,
    `Utilisateurs avec produit : ${formatTelegramValue(stats.usersWithProducts)}`,
    `Solde total : ${formatTelegramValue(stats.totalBalance)} XOF`,
    `Revenus totaux : ${formatTelegramValue(stats.totalEarnings)} XOF`,
    `Commissions : ${formatTelegramValue(stats.totalCommissions)} XOF`,
    `Dépôts du jour : ${formatTelegramValue(stats.todayDeposits)} XOF`,
    `Dépôts cumulés : ${formatTelegramValue(stats.totalDeposits)} XOF`,
    `Retraits du jour : ${formatTelegramValue(stats.todayWithdrawals)} XOF`,
    `Retraits cumulés : ${formatTelegramValue(stats.totalWithdrawals)} XOF`,
    `Dépôts en attente : ${formatTelegramValue(stats.pendingDeposits)} XOF (${formatTelegramValue(stats.pendingDepositsCount)})`,
    `Retraits en attente : ${formatTelegramValue(stats.pendingWithdrawals)} XOF (${formatTelegramValue(stats.pendingWithdrawalsCount)})`,
  ].join("\n"));
}

export async function sendTelegramSecurityAlert(ip: string, attemptMessage: string): Promise<void> {
  await sendTelegramMessage([
    "🚨 <b>Alerte de sécurité</b>",
    "Trop de tentatives de connexion administrateur ou utilisateur.",
    `Erreur : <code>${formatTelegramValue(attemptMessage)}</code>`,
    `Adresse IP : <code>${formatTelegramValue(ip)}</code>`,
    "Accès temporairement bloqué pendant 15 minutes.",
  ].join("\n"));
}

export async function sendTelegramInpayError(params: {
  operation: string;
  error: unknown;
  country?: string;
  amount?: unknown;
  reference?: unknown;
  recordId?: unknown;
  requestUrl?: unknown;
  requestData?: Record<string, unknown>;
  orderNumber?: unknown;
}): Promise<void> {
  const errorMessage = params.error instanceof Error
    ? params.error.message
    : String(params.error || "Erreur inconnue");
  await sendTelegramMessage([
    "❌ <b>Erreur InPay</b>",
    `Opération : ${formatTelegramValue(params.operation)}`,
    params.recordId !== undefined ? `ID : ${formatTelegramValue(params.recordId)}` : "",
    params.reference ? `Référence : ${formatTelegramValue(params.reference)}` : "",
    params.country ? `Pays : ${formatTelegramValue(params.country)}` : "",
    params.amount !== undefined ? `Montant : <b>${formatTelegramValue(params.amount)} XOF</b>` : "",
    params.orderNumber !== undefined
      ? `Numéro de commande marchand : <code>${formatTelegramValue(params.orderNumber)}</code>`
      : "",
    params.requestUrl
      ? `URL de requête : <code>${formatTelegramValue(params.requestUrl)}</code>`
      : "",
    params.requestData
      ? `Données envoyées :\n<pre>${formatTelegramValue(JSON.stringify(params.requestData, null, 2))}</pre>`
      : "",
    `Erreur exacte : <code>${formatTelegramValue(errorMessage)}</code>`,
  ].filter(Boolean).join("\n"));
}

export function startTelegramBot(): void {
  if (!isTelegramConfigured()) return;
  let updateOffset = 0;
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const response = await telegramRequest("getUpdates", {
        offset: updateOffset,
        timeout: 0,
        allowed_updates: ["message"],
      });
      for (const update of response?.result || []) {
        updateOffset = Math.max(updateOffset, Number(update.update_id) + 1);
        const message = update.message;
        if (!message?.text || String(message.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID)) continue;
        const reply = await handleTelegramCommand(message.text, String(message.chat.id));
        const adminBaseUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
          || (process.env.REPLIT_DEV_DOMAIN?.trim()
            ? `https://${process.env.REPLIT_DEV_DOMAIN.trim()}`
            : "");
        const adminUrl = adminBaseUrl ? `${adminBaseUrl}/admin` : "";
        const replyBody: Record<string, unknown> = {
          chat_id: message.chat.id,
          text: reply,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        };
        if (adminUrl) {
          replyBody.reply_markup = {
            inline_keyboard: [[
              { text: "Ouvrir l'administration", url: adminUrl },
            ]],
          };
        }
        await telegramRequest("sendMessage", replyBody);
      }
    } catch (error: any) {
      console.error("[telegram] command polling failed:", error.message);
    } finally {
      polling = false;
    }
  };
  void poll();
  setInterval(() => void poll(), 5000);
}