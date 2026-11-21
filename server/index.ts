import express, { type Request, Response, NextFunction } from "express";
import { reconcilePendingDrimPayDeposits, registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seed } from "./seed";
import { storage } from "./storage";
import {
  ashtechTransactionMatches,
  getTransaction as ashtechGetTransaction,
  isAshtechConfigured,
  mapAshtechStatus,
} from "./ashtechpay";
import { sendDailyTelegramSummary, startTelegramBot } from "./telegram";
import { MemoryWindowRateLimiter } from "./security-rate-limit";

const app = express();
const httpServer = createServer(app);
app.set("trust proxy", 1);

const apiTrafficLimiter = new MemoryWindowRateLimiter();
app.use("/api", (req, res, next) => {
  const requestPath = req.originalUrl.split("?")[0];
  const isWebhook = requestPath.startsWith("/api/webhooks/");
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const decision = apiTrafficLimiter.consume(
    `api:${clientIp}`,
    isWebhook ? 600 : 240,
    60_000,
  );
  if (!decision.allowed) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
    res.setHeader("Cache-Control", "no-store");
    return res.status(429).json({ message: "Trop de demandes. Réessayez dans une minute." });
  }
  if (req.method === "POST" && requestPath.replace(/\/+$/, "") === "/api/deposits") {
    const uploadDecision = apiTrafficLimiter.consume(`deposit-body:${clientIp}`, 5, 60_000);
    if (!uploadDecision.allowed) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(uploadDecision.retryAfterMs / 1000))));
      res.setHeader("Cache-Control", "no-store");
      return res.status(429).json({ message: "Trop de demandes de dépôt. Réessayez dans une minute." });
    }
  }
  return next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const captureRawBody = (req: express.Request, _res: express.Response, buf: Buffer) => {
  req.rawBody = buf;
};
const standardJsonParser = express.json({ limit: "1mb", verify: captureRawBody });
// Manual deposit screenshots are the only large JSON payload in the API.
const manualDepositJsonParser = express.json({ limit: "8mb", verify: captureRawBody });
app.use((req, res, next) => {
  const requestPath = req.originalUrl.split("?")[0].replace(/\/+$/, "");
  const parser = req.method === "POST" && requestPath === "/api/deposits"
    ? manualDepositJsonParser
    : standardJsonParser;
  return parser(req, res, next);
});

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Security: block the well-known /admin path at the server level.
  // Any request to /admin or /admin/* returns a plain 404, indistinguishable
  // from a non-existent route. The real admin UI is served only under the
  // The path is only an obscurity layer; admin API authorization remains mandatory.
  app.use((req, res, next) => {
    const p = req.path;
    if (p === "/admin" || p.startsWith("/admin/")) {
      return res.status(404).send("Not found");
    }
    next();
  });

  // Seed database with initial data
  await seed().catch(console.error);
  
  await registerRoutes(httpServer, app);
  setTimeout(() => void reconcilePendingDrimPayDeposits(), 5000);
  setInterval(() => void reconcilePendingDrimPayDeposits(), 5000);
  startTelegramBot();
  const scheduleTelegramSummary = () => {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(now.getHours() < 12 ? 12 : 24);
    const delay = Math.max(1000, next.getTime() - now.getTime());
    setTimeout(() => {
      void sendDailyTelegramSummary().catch((error) => console.error("[telegram] summary failed:", error.message));
      scheduleTelegramSummary();
    }, delay);
  };
  scheduleTelegramSummary();

  // Process daily earnings and staking releases
  let isProcessingEarnings = false;
  const processEarningsInterval = async () => {
    if (isProcessingEarnings) return;
    isProcessingEarnings = true;
    try {
      try {
        await storage.processEarnings();
        log("Daily earnings processed successfully", "earnings");
      } catch (error) {
        console.error("Error processing daily earnings:", error);
      }
      try {
        await storage.releaseMaturedStakings();
      } catch (error) {
        console.error("Error releasing stakings:", error);
      }
    } finally {
      isProcessingEarnings = false;
    }
  };
  
  // Run immediately on startup
  setTimeout(processEarningsInterval, 5000);
  
  // Then run every 5 minutes to ensure timely earnings processing
  setInterval(processEarningsInterval, 5 * 60 * 1000);

  // Clean up deposit screenshots: approved/rejected deposits lose their image after 24h
  const cleanupScreenshots = async () => {
    try {
      await storage.cleanupDepositScreenshots();
      log("Deposit screenshots cleanup done", "cleanup");
    } catch (error) {
      console.error("Error cleaning up deposit screenshots:", error);
    }
  };
  setTimeout(cleanupScreenshots, 10000);
  setInterval(cleanupScreenshots, 60 * 60 * 1000); // every hour

  // Reconcile AshtechPay deposits on the server, independently of the user's
  // browser. A pending transaction is checked until three hours old; at the
  // deadline one final provider check is made before marking it rejected.
  let isReconcilingAshtech = false;
  const reconcileAshtechDeposits = async () => {
    if (!isAshtechConfigured() || isReconcilingAshtech) return;
    isReconcilingAshtech = true;
    try {
      const pendingDeposits = await storage.getPendingAshtechDeposits();
      for (const deposit of pendingDeposits) {
        if (!deposit.ashtechTransactionId) continue;
        const ageMs = Date.now() - new Date(deposit.createdAt).getTime();
        const expired = ageMs >= 3 * 60 * 60 * 1000;
        try {
          const result = await ashtechGetTransaction(deposit.ashtechTransactionId);
          if (!ashtechTransactionMatches(result, {
            amount: Number(deposit.amount),
            countryCode: deposit.country,
            reference: deposit.ashtechReference,
            transactionId: deposit.ashtechTransactionId,
          })) {
            console.warn(`[ashtechpay] transaction mismatch for deposit #${deposit.id}`);
            continue;
          }
          const status = mapAshtechStatus(result.status);
          if (status === "approved") {
            await storage.approveDepositAndCredit(
              deposit.id,
              undefined,
              `Dépôt #${deposit.id} approuvé`,
            );
          } else if (status === "rejected" || expired) {
            await storage.rejectDeposit(deposit.id);
            log(`AshtechPay deposit #${deposit.id} marked rejected${expired ? " after 3 hours" : ""}`, "ashtechpay");
          }
        } catch (error) {
          if (expired) {
            await storage.rejectDeposit(deposit.id);
            log(`AshtechPay deposit #${deposit.id} marked rejected after 3 hours (provider unavailable)`, "ashtechpay");
          } else {
            console.error(`[ashtechpay] reconciliation failed for deposit #${deposit.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("[ashtechpay] reconciliation cycle failed:", error);
    } finally {
      isReconcilingAshtech = false;
    }
  };
  setTimeout(reconcileAshtechDeposits, 15000);
  setInterval(reconcileAshtechDeposits, 5 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("Unhandled request error:", {
      status,
      type: typeof err?.name === "string" ? err.name : "Error",
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({
      message: status >= 500 ? "Erreur interne du serveur." : err.message || "Requête invalide.",
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
