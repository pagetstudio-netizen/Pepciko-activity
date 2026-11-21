import { 
  users, products, userProducts, deposits, withdrawals, withdrawalWallets,
  paymentChannels, paymentNumbers, stakingProducts, userStakings, referralCommissions, tasks, userTasks, transactions, platformSettings, adminAuditLog,
  giftCodes, giftCodeClaims, countries, blogPosts, userSecurity,
  type User, type Product, type UserProduct, type Deposit, type Withdrawal, type WithdrawalWallet,
  type PaymentChannel, type PaymentNumber, type StakingProduct, type UserStaking, type ReferralCommission, type Task, type UserTask, type Transaction, type PlatformSetting,
  type GiftCode, type GiftCodeClaim, type Country, type BlogPost
} from "@shared/schema";
import { db } from "./db";
import { calculateNetAdminBalanceCredit } from "./admin-balance-credit";
import { INVITATION_TASK_KEY_PREFIX, countQualifiedDirectReferrals } from "./invitation-tasks";
import { summarizeTeamProductPurchases } from "./team-investment-stats";
import { resolveSignupBonus } from "./signup-bonus";
import {
  calculateDailyPayoutCatchUp,
  calculateDailyProductPayout,
  calculateMaturityPayout,
  getProductPayoutMode,
} from "./product-payout";
import { isUserProductRevoked } from "./product-revocation";
import {
  getHighestStablePurchasePrice,
  hasActiveWellnessProduct,
  hasPurchasedActivityLaunch,
  hasPurchasedStableProduct,
  MAX_PRODUCT_PURCHASE_QUANTITY,
  isProductWithinStablePurchaseLimit,
  isValidProductPurchaseQuantity,
  isProductStockFull,
} from "../shared/product-purchase-limit";
import { isFirstPaidStableProductPurchase } from "./referral-commission-policy";
import { getStablePurchaseSpinAwards } from "./fortune-wheel-policy";
import { hasQualifyingActiveStableProduct } from "./withdrawal-product-eligibility";
import {
  FORTUNE_WHEEL_DRAW_PRIZES,
  FORTUNE_WHEEL_PAYOUT_WALLET,
  FORTUNE_WHEEL_PAYOUT_TRANSACTION_TYPE,
} from "@shared/fortune-wheel";
import {
  calculateDailyCheckinStreak,
  calculateDailyCheckinStreakAfterClaim,
  DAILY_CHECKIN_COOLDOWN_MS,
  getDailyCheckinRewardForVip,
  getDailyCheckinCooldownUntil,
  getDailyCheckinDateKey,
} from "@shared/daily-checkin";
import {
  calculateVipLevels,
  VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES,
} from "@shared/vip-levels";
import { eq, and, asc, desc, sql, gte, lte, or, isNull, inArray, lt, ne } from "drizzle-orm";
import { hashPassword } from "./password-utils";
import {
  BLOG_DRAFT_STALE_MS,
  BLOG_SUCCESSFUL_WITHDRAWAL_STATUS,
  getBlogLocalDayWindow,
} from "./blog-policy";

const DRIMPAY_STATUS_CHECK_SETTING_PREFIX = "__internal_drimpay_status_checks:";
const DAILY_CHECKIN_TRANSACTION_TYPE = "daily_checkin";
const DEPOSIT_PROVIDER_METADATA_FIELDS = [
  "omnipayReference",
  "omnipayId",
  "drimpayOrderId",
  "drimpayReference",
  "westpayReference",
  "inpayOutTradeNo",
  "inpayOrderNumber",
  "ashtechTransactionId",
  "ashtechReference",
  "sendavapayReference",
  "sendavapayToken",
] as const;
const WITHDRAWAL_PROVIDER_METADATA_FIELDS = [
  "inpayOrderNumber",
  "drimpayReference",
  "omnipayId",
] as const;

function pickProviderMetadata<T extends object>(
  data: Partial<T>,
  allowedFields: readonly string[],
): Partial<T> {
  const entries = Object.entries(data);
  const invalidField = entries.find(([key]) => !allowedFields.includes(key));
  if (invalidField) {
    throw new Error("Seules les références fournisseur peuvent être modifiées ici.");
  }
  return Object.fromEntries(entries) as Partial<T>;
}

function maskBlogAuthorPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Membre";
  const maskedLength = Math.max(4, Math.min(8, digits.length - 4));
  return `${digits.slice(0, 2)}${"*".repeat(maskedLength)}${digits.slice(-2)}`;
}

export type BlogPostDraftAttempt =
  | { status: "created"; post: BlogPost; staleImageKeys: string[] }
  | { status: "withdrawal_required"; staleImageKeys: string[] }
  | { status: "daily_limit"; staleImageKeys: string[] }
  | { status: "user_not_found"; staleImageKeys: string[] };

export interface BlogPostingEligibility {
  userFound: boolean;
  hasSuccessfulWithdrawal: boolean;
  submittedToday: boolean;
}

export type BlogApprovalResult =
  | { status: "approved"; userId: number; rewardAmount: number; withdrawalBalance: string }
  | { status: "not_found" }
  | { status: "already_reviewed" }
  | { status: "user_not_found" };

export interface DailyCheckinStatus {
  rewardAmount: number;
  hasActiveStableProduct: boolean;
  canClaim: boolean;
  nextClaimAt: string | null;
  streakDays: number;
  totalCapturedProfit: number;
  currentMonth: string;
  today: string;
  calendar: Array<{ date: string; amount: number; claimed: boolean; isToday: boolean }>;
}

export type DailyCheckinClaimOutcome =
  | {
      status: "claimed";
      amount: number;
      withdrawalBalance: number;
      streakDays: number;
      totalCapturedProfit: number;
      nextClaimAt: string;
    }
  | {
      status: "not_found" | "product_required" | "cooldown" | "already_claimed";
      nextClaimAt: string | null;
    };

function productTermsAtPurchase(product: Product, userProduct: UserProduct): Product {
  return {
    ...product,
    name: userProduct.purchaseProductName ?? product.name,
    price: userProduct.purchasePrice ?? product.price,
    dailyEarnings: userProduct.purchaseDailyEarnings ?? product.dailyEarnings,
    cycleDays: userProduct.purchaseCycleDays ?? product.cycleDays,
    totalReturn: userProduct.purchaseTotalReturn ?? product.totalReturn,
    imageUrl: userProduct.purchaseImageUrl ?? product.imageUrl,
    productType: userProduct.purchaseProductType ?? product.productType,
  };
}

async function getApprovedDepositSummary(userIds: number[], startAt?: Date, endAt?: Date) {
  if (userIds.length === 0) return { amount: 0, count: 0 };

  const conditions = [
    eq(deposits.status, "approved"),
    inArray(deposits.userId, userIds),
    ...(startAt ? [gte(deposits.createdAt, startAt)] : []),
    ...(endAt ? [lt(deposits.createdAt, endAt)] : []),
  ];
  const [summary] = await db.select({
    amount: sql<string>`COALESCE(SUM(${deposits.amount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(deposits).where(and(...conditions));

  return {
    amount: Number(summary?.amount ?? 0),
    count: Number(summary?.count ?? 0),
  };
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string, country: string): Promise<User | undefined>;
  getUserByPhoneAnyCountry(phone: string): Promise<User | undefined>;
  getUserByReferralCode(code: string): Promise<User | undefined>;
  getTransactionPasswordHash(userId: number): Promise<string | null>;
  setTransactionPasswordIfMissing(userId: number, passwordHash: string): Promise<boolean>;
  clearTransactionPassword(userId: number): Promise<void>;
  createUser(data: Partial<User>): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  claimFreeProductReward(userId: number, amount: number): Promise<boolean>;
  getDailyCheckinStatus(userId: number): Promise<DailyCheckinStatus | null>;
  claimDailyCheckinBonus(userId: number): Promise<DailyCheckinClaimOutcome>;
  getFortuneWheelStatus(
    userId: number,
  ): Promise<{ userFound: boolean; availableSpins: number }>;
  spinFortuneWheel(
    userId: number,
    amount: number | null,
  ): Promise<{ userFound: boolean; claimed: boolean; availableSpins: number }>;
  grantFortuneWheelSpins(userId: number, count: number): Promise<number | undefined>;
  setBalances(userId: number, depositBalance: number, withdrawalBalance: number, processedBy?: number): Promise<User>;
  getAllUsers(filter?: string, limit?: number, offset?: number): Promise<{ users: User[], total: number }>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductStockCounts(productIds?: number[]): Promise<Record<number, number>>;
  createProduct(data: Partial<Product>): Promise<Product>;
  createProducts(data: Partial<Product>[]): Promise<Product[]>;
  updateProduct(id: number, data: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<{ archived: boolean }>;
  
  // User Products
  getUserProducts(userId: number): Promise<(UserProduct & { product: Product })[]>;
  getAllUserProducts(userId: number): Promise<{ userProduct: UserProduct; product: Product }[]>;
  hasActiveStableProduct(userId: number): Promise<boolean>;
  purchaseProduct(
    userId: number,
    productId: number,
    assignedByAdmin?: boolean,
    quantity?: number,
  ): Promise<UserProduct>;
  removeUserProduct(userId: number, productId: number): Promise<void>;
  updateUserProduct(id: number, data: Partial<UserProduct>): Promise<UserProduct>;
  processEarnings(): Promise<void>;
  
  // Deposits
  createDeposit(data: Partial<Deposit>): Promise<Deposit>;
  getDeposit(id: number): Promise<Deposit | undefined>;
  getDepositBySendavapayReference(reference: string): Promise<Deposit | undefined>;
  getDepositByDrimPayReference(reference: string): Promise<Deposit | undefined>;
  getDepositByDrimPayOrderId(orderId: string): Promise<Deposit | undefined>;
  getDepositByInpayOutTradeNo(reference: string): Promise<Deposit | undefined>;
  getDepositByWestpayReference(reference: string): Promise<Deposit | undefined>;
  getDepositByAshtechReference(reference: string): Promise<Deposit | undefined>;
  getDepositByAshtechTransactionId(transactionId: string): Promise<Deposit | undefined>;
  getPendingAshtechDeposits(): Promise<Deposit[]>;
  getPendingDrimPayDeposits(): Promise<Deposit[]>;
  incrementDrimPayStatusCheckCount(depositId: number): Promise<number>;
  clearDrimPayStatusCheckCount(depositId: number): Promise<void>;
  getDeposits(status?: string): Promise<(Deposit & { user: User })[]>;
  getUserApprovedDepositTotal(userId: number): Promise<number>;
  getUserVipQualifyingTotal(userId: number): Promise<number>;
  getUserDeposits(userId: number): Promise<Deposit[]>;
  approveDepositAndCredit(id: number, processedBy?: number, description?: string): Promise<Deposit | undefined>;
  rejectDeposit(id: number, processedBy?: number, clearScreenshot?: boolean): Promise<Deposit | undefined>;
  setDepositNonterminalStatus(id: number, status: "pending" | "processing", data?: Partial<Deposit>): Promise<Deposit | undefined>;
  updateDeposit(id: number, data: Partial<Deposit>): Promise<Deposit>;
  cleanupDepositScreenshots(): Promise<void>;
  
  // Withdrawals
  reserveWithdrawal(userId: number, amount: number, data: Partial<Withdrawal>): Promise<Withdrawal | undefined>;
  getWithdrawals(status?: string): Promise<(Withdrawal & { user: User })[]>;
  getUserWithdrawals(userId: number): Promise<Withdrawal[]>;
  getWithdrawal(id: number): Promise<Withdrawal | undefined>;
  getWithdrawalByInpayOutTradeNo(reference: string): Promise<Withdrawal | undefined>;
  getWithdrawalByDrimPayReference(reference: string): Promise<Withdrawal | undefined>;
  claimInpayWithdrawal(id: number, outTradeNo: string): Promise<Withdrawal | undefined>;
  releaseInpayWithdrawal(id: number, outTradeNo: string): Promise<Withdrawal | undefined>;
  claimDrimPayWithdrawal(id: number, externalRef: string): Promise<Withdrawal | undefined>;
  releaseDrimPayWithdrawal(id: number, externalRef: string): Promise<Withdrawal | undefined>;
  claimPpayProsWithdrawal(id: number, merchantOrderNo: string): Promise<Withdrawal | undefined>;
  releasePpayProsWithdrawal(id: number, merchantOrderNo: string): Promise<Withdrawal | undefined>;
  finalizeWithdrawal(
    id: number,
    status: "approved" | "rejected",
    processedBy?: number,
    details?: Partial<Withdrawal>,
    refundProvider?: string,
    allowedStatuses?: Array<"pending" | "processing">,
  ): Promise<Withdrawal | undefined>;
  setWithdrawalProcessing(id: number, data?: Partial<Withdrawal>): Promise<Withdrawal | undefined>;
  updateWithdrawal(id: number, data: Partial<Withdrawal>): Promise<Withdrawal>;
  getUserWithdrawalCountToday(userId: number): Promise<number>;
  
  // Wallets
  getWallets(userId: number): Promise<WithdrawalWallet[]>;
  createWallet(data: Partial<WithdrawalWallet>): Promise<WithdrawalWallet>;
  deleteWallet(userId: number, id: number): Promise<boolean>;
  setDefaultWallet(userId: number, walletId: number): Promise<void>;
  getDefaultWallet(userId: number): Promise<WithdrawalWallet | undefined>;
  
  // Payment Channels
  getPaymentChannels(): Promise<PaymentChannel[]>;
  getActivePaymentChannels(): Promise<PaymentChannel[]>;
  getPaymentChannel(id: number): Promise<PaymentChannel | undefined>;
  createPaymentChannel(data: Partial<PaymentChannel>): Promise<PaymentChannel>;
  updatePaymentChannel(id: number, data: Partial<PaymentChannel>): Promise<PaymentChannel>;
  deletePaymentChannel(id: number): Promise<void>;
  
  // Referrals
  getReferrals(userId: number, level: number): Promise<User[]>;
  createReferralCommission(data: Partial<ReferralCommission>): Promise<ReferralCommission>;
  getUserCommissions(userId: number): Promise<number>;
  getTeamStats(userId: number): Promise<{ level1Count: number; level2Count: number; level3Count: number; totalCommission: number; level1Commission: number; level2Commission: number; level3Commission: number; level1Invested: number; level2Invested: number; level3Invested: number; level1PaidProductUsers: number; level2PaidProductUsers: number; level3PaidProductUsers: number; level1Recharged: number; teamRechargeAmount: number; level1RechargeAmount: number; level2RechargeAmount: number; level3RechargeAmount: number }>;
  getTeamStatsSimple(userId: number): Promise<{ level1Count: number; level2Count: number; level3Count: number; totalCommission: number }>;
  
  // Tasks
  getBlogPosts(): Promise<Array<Pick<BlogPost, "id" | "content" | "createdAt" | "imageKeys" | "rewardAmount"> & { authorPhone: string }>>;
  getAdminBlogSubmissions(): Promise<Array<Pick<BlogPost, "id" | "content" | "createdAt" | "imageKeys"> & { authorPhone: string }>>;
  hasSuccessfulWithdrawal(userId: number): Promise<boolean>;
  getBlogPostingEligibility(userId: number, now?: Date): Promise<BlogPostingEligibility>;
  createBlogPostDraft(userId: number, content: string, imageKeys: string[], now?: Date): Promise<BlogPostDraftAttempt>;
  publishBlogPostDraft(userId: number, postId: number): Promise<BlogPost>;
  deleteBlogPostDraft(userId: number, postId: number): Promise<void>;
  getBlogPostImageKey(postId: number, imageIndex: number, forAdmin?: boolean): Promise<string | undefined>;
  approveBlogPost(postId: number, adminId: number, rewardAmount: number): Promise<BlogApprovalResult>;
  getTasks(): Promise<Task[]>;
  getTasksWithStatus(userId: number): Promise<(Task & { isCompleted: boolean; canClaim: boolean; currentInvites: number })[]>;
  claimTask(userId: number, taskId: number): Promise<void>;
  
  // Transactions
  getUserTransactions(userId: number): Promise<Transaction[]>;
  
  // Settings
  getSetting(key: string): Promise<string | null>;
  getSettings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string, modifiedBy?: number): Promise<void>;
  
  // Admin
  getStats(): Promise<any>;
  logAdminAction(adminId: number, action: string, targetUserId: number | null, details: string): Promise<void>;
  resetStats(): Promise<void>;
  
  // Gift Codes
  getAllGiftCodes(): Promise<GiftCode[]>;
  getGiftCodeByCode(code: string): Promise<GiftCode | undefined>;
  createGiftCode(data: { code: string; amount: string; maxUses: number; expiresAt: Date; createdBy: number }): Promise<GiftCode>;
  deleteGiftCode(id: number): Promise<void>;
  hasUserClaimedGiftCode(userId: number, giftCodeId: number): Promise<boolean>;
  claimGiftCode(userId: number, giftCodeId: number, amount: number): Promise<void>;

  // Countries
  getCountries(): Promise<Country[]>;
  getActiveCountries(): Promise<Country[]>;
  getCountry(id: number): Promise<Country | undefined>;
  createCountry(data: Partial<Country>): Promise<Country>;
  updateCountry(id: number, data: Partial<Country>): Promise<Country>;
  deleteCountry(id: number): Promise<void>;

  // Payment Numbers
  getPaymentNumbers(): Promise<PaymentNumber[]>;
  getAdminPaymentNumberStatistics(): Promise<{
    paymentNumbers: { paymentNumberId: number; totalAmount: number; todayAmount: number }[];
    bankers: {
      bankerId: number;
      fullName: string;
      phone: string;
      country: string;
      totalWithdrawals: number;
      todayWithdrawals: number;
    }[];
  }>;
  getPaymentNumber(id: number): Promise<PaymentNumber | undefined>;
  getPaymentNumbersByCountry(country: string): Promise<PaymentNumber[]>;
  createPaymentNumber(data: Partial<PaymentNumber>): Promise<PaymentNumber>;
  updatePaymentNumber(id: number, data: Partial<PaymentNumber>): Promise<PaymentNumber>;
  deletePaymentNumber(id: number): Promise<void>;

  // Staking
  getStakingProducts(): Promise<StakingProduct[]>;
  getActiveStakingProducts(): Promise<StakingProduct[]>;
  getStakingProduct(id: number): Promise<StakingProduct | undefined>;
  createStakingProduct(data: Partial<StakingProduct>): Promise<StakingProduct>;
  updateStakingProduct(id: number, data: Partial<StakingProduct>): Promise<StakingProduct>;
  deleteStakingProduct(id: number): Promise<void>;
  purchaseStaking(userId: number, stakingProductId: number): Promise<UserStaking>;
  getUserStakings(userId: number): Promise<(UserStaking & { product: StakingProduct })[]>;
  getAllUserStakings(): Promise<(UserStaking & { product: StakingProduct; user: User })[]>;
  releaseMaturedStakings(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByPhone(phone: string, country: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.phone, phone), eq(users.country, country)));
    return user || undefined;
  }

  async getUserByPhoneAnyCountry(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`UPPER(${users.referralCode}) = UPPER(${code})`
    );
    return user || undefined;
  }

  async getTransactionPasswordHash(userId: number): Promise<string | null> {
    const [security] = await db
      .select({ passwordHash: userSecurity.transactionPasswordHash })
      .from(userSecurity)
      .where(eq(userSecurity.userId, userId))
      .limit(1);
    return security?.passwordHash ?? null;
  }

  async setTransactionPasswordIfMissing(userId: number, passwordHash: string): Promise<boolean> {
    const inserted = await db
      .insert(userSecurity)
      .values({ userId, transactionPasswordHash: passwordHash })
      .onConflictDoNothing()
      .returning({ userId: userSecurity.userId });
    return inserted.length > 0;
  }

  async clearTransactionPassword(userId: number): Promise<void> {
    await db.delete(userSecurity).where(eq(userSecurity.userId, userId));
  }

  async createUser(data: Partial<User>): Promise<User> {
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hashedPassword = await hashPassword(data.password!);

    // Get signup bonus from settings; a missing or invalid value means no bonus.
    let signupBonus = 0;
    try {
      const settings = await this.getSettings();
      signupBonus = resolveSignupBonus(settings.signupBonus);
    } catch {}

    return db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        fullName: data.fullName!,
        phone: data.phone!,
        country: data.country!,
        password: hashedPassword,
        referredBy: data.referredBy ?? null,
        referralCode,
        balance: signupBonus.toFixed(2),
        depositBalance: signupBonus.toFixed(2),
        withdrawalBalance: "0",
      }).returning();

      if (signupBonus > 0) {
        await tx.insert(transactions).values({
          userId: user.id,
          type: "bonus",
          amount: signupBonus.toFixed(2),
          description: "Bonus d'inscription",
        });
      }
      return user;
    });
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    if ("balance" in data || "depositBalance" in data || "withdrawalBalance" in data) {
      throw new Error("Les soldes doivent être modifiés via les opérations financières contrôlées.");
    }
    if (data.password) {
      data.password = await hashPassword(data.password);
    }
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  private async adjustBalance(
    userId: number,
    wallet: "deposit" | "withdrawal",
    amount: number,
    executor: any = db,
  ): Promise<boolean> {
    if (!Number.isFinite(amount) || Math.round(amount * 100) !== amount * 100) {
      throw new Error("Montant de solde invalide");
    }

    const delta = Number(amount.toFixed(2));
    const walletColumn = wallet === "deposit" ? users.depositBalance : users.withdrawalBalance;
    const walletUpdate = wallet === "deposit"
      ? { depositBalance: sql`${users.depositBalance} + ${delta}` }
      : { withdrawalBalance: sql`${users.withdrawalBalance} + ${delta}` };
    const hasSufficientBalance = wallet === "deposit"
      ? gte(users.depositBalance, (-delta).toFixed(2))
      : gte(users.withdrawalBalance, (-delta).toFixed(2));
    const conditions = delta < 0
      ? and(eq(users.id, userId), hasSufficientBalance)
      : eq(users.id, userId);
    const [updated] = await executor.update(users).set({
      ...walletUpdate,
      balance: sql`${users.balance} + ${delta}`,
    }).where(conditions).returning({ id: users.id });
    return Boolean(updated);
  }

  async claimFreeProductReward(userId: number, amount: number): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      throw new Error("Montant de la récompense invalide.");
    }
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return db.transaction(async (tx) => {
      const [claimed] = await tx.update(users)
        .set({ lastFreeProductClaim: now })
        .where(and(
          eq(users.id, userId),
          or(isNull(users.lastFreeProductClaim), lt(users.lastFreeProductClaim, startOfDay)),
        ))
        .returning({ id: users.id });
      if (!claimed) return false;

      if (!await this.adjustBalance(userId, "deposit", amount, tx)) {
        throw new Error("Impossible de créditer la récompense.");
      }
      await tx.insert(transactions).values({
        userId,
        type: "free_claim",
        amount: amount.toFixed(2),
        description: "Bonus produit gratuit",
        createdAt: now,
      });
      return true;
    });
  }

  async getDailyCheckinStatus(userId: number): Promise<DailyCheckinStatus | null> {
    const [member] = await db.select({
      country: users.country,
      lastDailyBonusClaim: users.lastDailyBonusClaim,
    })
      .from(users)
      .where(eq(users.id, userId));
    if (!member) return null;

    const [claims, hasActiveStableProduct, vipQualifyingTotal] = await Promise.all([
      db.select({
        amount: transactions.amount,
        createdAt: transactions.createdAt,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.type, DAILY_CHECKIN_TRANSACTION_TYPE),
        ))
        .orderBy(desc(transactions.createdAt)),
      this.hasActiveStableProduct(userId),
      this.getUserVipQualifyingTotal(userId),
    ]);
    const currentVipLevel = calculateVipLevels(vipQualifyingTotal).currentLevel;
    const rewardAmount = getDailyCheckinRewardForVip(currentVipLevel);

    const now = new Date();
    const today = getDailyCheckinDateKey(now, member.country);
    const claimDates = claims.map((claim) => getDailyCheckinDateKey(claim.createdAt, member.country));
    const lastClaimAt = claims[0]?.createdAt
      && (!member.lastDailyBonusClaim || claims[0].createdAt > member.lastDailyBonusClaim)
      ? claims[0].createdAt
      : member.lastDailyBonusClaim;
    const lastClaimDate = lastClaimAt
      ? getDailyCheckinDateKey(lastClaimAt, member.country)
      : null;
    const cooldownUntil = getDailyCheckinCooldownUntil(lastClaimAt, now);
    const cooldownActive = Boolean(cooldownUntil);
    const alreadyClaimedToday = lastClaimDate === today;
    const canClaim = hasActiveStableProduct && !cooldownActive && !alreadyClaimedToday;
    const currentMonth = today.slice(0, 7);
    const monthAmounts = new Map<string, number>();
    let totalCapturedProfit = 0;

    for (const claim of claims) {
      const amount = Number(claim.amount) || 0;
      totalCapturedProfit += amount;
      const date = getDailyCheckinDateKey(claim.createdAt, member.country);
      if (date.startsWith(`${currentMonth}-`) && !monthAmounts.has(date)) {
        monthAmounts.set(date, amount);
      }
    }

    const [year, month] = currentMonth.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const calendar = Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${currentMonth}-${String(index + 1).padStart(2, "0")}`;
      const amount = monthAmounts.get(date);
      return {
        date,
        amount: amount ?? 0,
        claimed: amount !== undefined,
        isToday: date === today,
      };
    });

    return {
      rewardAmount,
      hasActiveStableProduct,
      canClaim,
      nextClaimAt: !canClaim && cooldownUntil && (cooldownActive || alreadyClaimedToday)
        ? cooldownUntil.toISOString()
        : null,
      streakDays: calculateDailyCheckinStreak(claimDates, today),
      totalCapturedProfit,
      currentMonth,
      today,
      calendar,
    };
  }

  async claimDailyCheckinBonus(userId: number): Promise<DailyCheckinClaimOutcome> {
    return db.transaction(async (tx) => {
      const [member] = await tx.select({
        country: users.country,
        lastDailyBonusClaim: users.lastDailyBonusClaim,
        withdrawalBalance: users.withdrawalBalance,
      })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!member) {
        return { status: "not_found", nextClaimAt: null };
      }

      const positions = await tx.select({
        purchaseProductType: userProducts.purchaseProductType,
        currentProductType: products.productType,
        isActive: userProducts.isActive,
        isRevoked: userProducts.isRevoked,
        daysRemaining: userProducts.daysRemaining,
        assignedByAdmin: userProducts.assignedByAdmin,
      })
        .from(userProducts)
        .innerJoin(products, eq(userProducts.productId, products.id))
        .where(eq(userProducts.userId, userId));

      if (!hasQualifyingActiveStableProduct(positions)) {
        return { status: "product_required", nextClaimAt: null };
      }

      const claims = await tx.select({
        amount: transactions.amount,
        createdAt: transactions.createdAt,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.type, DAILY_CHECKIN_TRANSACTION_TYPE),
        ))
        .orderBy(desc(transactions.createdAt));
      const now = new Date();
      const today = getDailyCheckinDateKey(now, member.country);
      const claimDates = claims.map((claim) => getDailyCheckinDateKey(claim.createdAt, member.country));
      const lastTransactionAt = claims[0]?.createdAt;
      const lastClaimAt = lastTransactionAt
        && (!member.lastDailyBonusClaim || lastTransactionAt > member.lastDailyBonusClaim)
        ? lastTransactionAt
        : member.lastDailyBonusClaim;
      const lastClaimDate = lastClaimAt
        ? getDailyCheckinDateKey(lastClaimAt, member.country)
        : null;
      const cooldownUntil = lastClaimAt
        ? new Date(lastClaimAt.getTime() + DAILY_CHECKIN_COOLDOWN_MS)
        : null;

      const activeCooldown = getDailyCheckinCooldownUntil(lastClaimAt, now);
      if (activeCooldown) {
        return { status: "cooldown", nextClaimAt: activeCooldown.toISOString() };
      }
      if (lastClaimDate === today) {
        return { status: "already_claimed", nextClaimAt: cooldownUntil?.toISOString() ?? null };
      }

      const [approvedDepositSummary] = await tx.select({
        amount: sql<number>`COALESCE(SUM(${deposits.amount}), 0)`,
      })
        .from(deposits)
        .where(and(
          eq(deposits.userId, userId),
          eq(deposits.status, "approved"),
        ));
      const [eligibleCreditSummary] = await tx.select({
        amount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          inArray(transactions.type, [...VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES]),
          sql`${transactions.amount} > 0`,
        ));
      const vipQualifyingTotal = Number(approvedDepositSummary?.amount ?? 0)
        + Number(eligibleCreditSummary?.amount ?? 0);
      const currentVipLevel = calculateVipLevels(vipQualifyingTotal).currentLevel;
      const rewardAmount = getDailyCheckinRewardForVip(currentVipLevel);
      const streakDays = calculateDailyCheckinStreakAfterClaim(claimDates, today);
      const totalCapturedProfit = claims.reduce(
        (sum, claim) => sum + (Number(claim.amount) || 0),
        rewardAmount,
      );
      const credited = await this.adjustBalance(
        userId,
        "withdrawal",
        rewardAmount,
        tx,
      );
      if (!credited) throw new Error("Impossible de créditer le bonus de connexion.");

      await tx.update(users)
        .set({ lastDailyBonusClaim: now })
        .where(eq(users.id, userId));
      await tx.insert(transactions).values({
        userId,
        type: DAILY_CHECKIN_TRANSACTION_TYPE,
        amount: String(rewardAmount),
        description: "Bonus de connexion quotidien",
        createdAt: now,
      });

      return {
        status: "claimed",
        amount: rewardAmount,
        withdrawalBalance: Number(member.withdrawalBalance) + rewardAmount,
        streakDays,
        totalCapturedProfit,
        nextClaimAt: new Date(now.getTime() + DAILY_CHECKIN_COOLDOWN_MS).toISOString(),
      };
    });
  }

  async getFortuneWheelStatus(
    userId: number,
  ): Promise<{ userFound: boolean; availableSpins: number }> {
    const [user] = await db.select({ fortuneWheelSpins: users.fortuneWheelSpins })
      .from(users)
      .where(eq(users.id, userId));
    return {
      userFound: Boolean(user),
      availableSpins: Math.max(0, Number(user?.fortuneWheelSpins ?? 0)),
    };
  }

  async spinFortuneWheel(
    userId: number,
    amount: number | null,
  ): Promise<{ userFound: boolean; claimed: boolean; availableSpins: number }> {
    if (
      amount !== null &&
      !FORTUNE_WHEEL_DRAW_PRIZES.includes(amount as (typeof FORTUNE_WHEEL_DRAW_PRIZES)[number])
    ) {
      throw new Error("Montant du gain invalide.");
    }

    return db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select({ fortuneWheelSpins: users.fortuneWheelSpins })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!lockedUser) {
        return { userFound: false, claimed: false, availableSpins: 0 };
      }

      const availableSpins = Math.max(0, Number(lockedUser.fortuneWheelSpins));
      if (availableSpins === 0) {
        return { userFound: true, claimed: false, availableSpins: 0 };
      }

      const [updatedSpins] = await tx.update(users)
        .set({ fortuneWheelSpins: sql`${users.fortuneWheelSpins} - 1` })
        .where(and(eq(users.id, userId), gte(users.fortuneWheelSpins, 1)))
        .returning({ fortuneWheelSpins: users.fortuneWheelSpins });
      if (!updatedSpins) {
        return { userFound: true, claimed: false, availableSpins: 0 };
      }

      if (amount !== null) {
        const updated = await this.adjustBalance(userId, FORTUNE_WHEEL_PAYOUT_WALLET, amount, tx);
        if (!updated) throw new Error("Impossible de créditer le gain.");

        await tx.insert(transactions).values({
          userId,
          type: FORTUNE_WHEEL_PAYOUT_TRANSACTION_TYPE,
          amount: amount.toString(),
          description: "Roue de la fortune — crédit au solde de retrait",
        });
      }

      return {
        userFound: true,
        claimed: true,
        availableSpins: updatedSpins.fortuneWheelSpins,
      };
    });
  }

  async grantFortuneWheelSpins(userId: number, count: number): Promise<number | undefined> {
    if (!Number.isSafeInteger(count) || count < 1 || count > 1000) {
      throw new Error("Le nombre de tours doit être compris entre 1 et 1 000.");
    }
    const [updated] = await db.update(users)
      .set({ fortuneWheelSpins: sql`${users.fortuneWheelSpins} + ${count}` })
      .where(eq(users.id, userId))
      .returning({ fortuneWheelSpins: users.fortuneWheelSpins });
    return updated?.fortuneWheelSpins;
  }

  async setBalances(
    userId: number,
    depositBalance: number,
    withdrawalBalance: number,
    processedBy?: number,
  ): Promise<User> {
    if (
      !Number.isFinite(depositBalance) || depositBalance < 0 ||
      !Number.isFinite(withdrawalBalance) || withdrawalBalance < 0
    ) {
      throw new Error("Les soldes doivent être des montants positifs ou nuls.");
    }

    const deposit = Number(depositBalance.toFixed(2));
    const withdrawal = Number(withdrawalBalance.toFixed(2));
    return db.transaction(async (tx) => {
      const [existing] = await tx.select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        country: users.country,
        depositBalance: users.depositBalance,
        withdrawalBalance: users.withdrawalBalance,
      })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!existing) throw new Error("Utilisateur non trouvé");

      const netCredit = calculateNetAdminBalanceCredit(
        Number(existing.depositBalance),
        Number(existing.withdrawalBalance),
        deposit,
        withdrawal,
      );
      const depositDelta = Number((deposit - Number(existing.depositBalance)).toFixed(2));
      const withdrawalDelta = Number((withdrawal - Number(existing.withdrawalBalance)).toFixed(2));

      const [user] = await tx.update(users).set({
        depositBalance: deposit.toFixed(2),
        withdrawalBalance: withdrawal.toFixed(2),
        balance: (deposit + withdrawal).toFixed(2),
        ...(netCredit > 0 ? { hasDeposited: true } : {}),
      }).where(eq(users.id, userId)).returning();
      if (!user) throw new Error("Utilisateur non trouvé");

      if (netCredit > 0) {
        const now = new Date();
        await tx.insert(deposits).values({
          userId,
          amount: netCredit,
          accountName: existing.fullName,
          accountNumber: existing.phone,
          country: existing.country,
          paymentMethod: "Crédit Admin",
          channelName: "Crédit administrateur",
          paymentMessage: "Hausse nette de solde enregistrée comme dépôt approuvé par l’Admin.",
          reference: `ADMIN-CREDIT-${userId}-${now.getTime()}`,
          status: "approved",
          processedAt: now,
          processedBy: processedBy ?? null,
        });
        await tx.insert(transactions).values({
          userId,
          type: "deposit",
          amount: netCredit.toFixed(2),
          description: "Crédit Admin enregistré comme dépôt approuvé",
          createdAt: now,
        });
      } else if (netCredit < 0 || depositDelta !== 0 || withdrawalDelta !== 0) {
        await tx.insert(transactions).values({
          userId,
          type: "admin_balance_adjustment",
          amount: netCredit.toFixed(2),
          description: `Ajustement Admin — dépôt ${depositDelta.toFixed(2)} FCFA, retrait ${withdrawalDelta.toFixed(2)} FCFA`,
        });
      }

      if (processedBy) {
        await tx.insert(adminAuditLog).values({
          adminId: processedBy,
          action: "update_balances",
          targetUserId: userId,
          details: `Soldes modifiés — dépôt: ${deposit}F, retrait: ${withdrawal}F`,
        });
      }

      return user;
    });
  }

  async getAllUsers(filter?: string, limit: number = 50, offset: number = 0): Promise<{ users: User[], total: number }> {
    let conditions: any[] = [];
    
    if (filter && filter.trim()) {
      const searchTerm = `%${filter.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${users.phone}) LIKE ${searchTerm}`,
          sql`LOWER(${users.fullName}) LIKE ${searchTerm}`,
          sql`LOWER(${users.referralCode}) LIKE ${searchTerm}`
        )
      );
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);
    
    const userList = await db.select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { users: userList, total: Number(countResult.count) };
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.sortOrder);
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.sortOrder);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductStockCounts(productIds?: number[]): Promise<Record<number, number>> {
    if (productIds?.length === 0) return {};
    const conditions = [
      eq(userProducts.assignedByAdmin, false),
      ...(productIds ? [inArray(userProducts.productId, productIds)] : []),
    ];
    const rows = await db.select({
      productId: userProducts.productId,
      count: sql<number>`count(distinct ${userProducts.userId})::int`,
    }).from(userProducts)
      .where(and(...conditions))
      .groupBy(userProducts.productId);
    return Object.fromEntries(rows.map((row) => [row.productId, Number(row.count)]));
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const [product] = await db.insert(products).values(data as any).returning();
    return product;
  }

  async createProducts(data: Partial<Product>[]): Promise<Product[]> {
    if (data.length === 0) return [];
    return await db.insert(products).values(data as any[]).returning();
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const [product] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<{ archived: boolean }> {
    return db.transaction(async (tx) => {
      const [product] = await tx.select({ id: products.id })
        .from(products)
        .where(eq(products.id, id))
        .for("update");
      if (!product) return { archived: false };

      const linkedPurchases = await tx.select({ id: userProducts.id })
        .from(userProducts)
        .where(eq(userProducts.productId, id))
        .limit(1);
      const linkedCommissions = await tx.select({ id: referralCommissions.id })
        .from(referralCommissions)
        .where(eq(referralCommissions.productId, id))
        .limit(1);

      if (linkedPurchases.length > 0 || linkedCommissions.length > 0) {
        await tx.update(products)
          .set({ isActive: false, isArchived: true })
          .where(eq(products.id, id));
        return { archived: true };
      }

      await tx.delete(products).where(eq(products.id, id));
      return { archived: false };
    });
  }

  // User Products
  async getUserProducts(userId: number): Promise<(UserProduct & { product: Product })[]> {
    const result = await db.select({
      userProduct: userProducts,
      product: products,
    }).from(userProducts)
      .innerJoin(products, eq(userProducts.productId, products.id))
      .where(and(eq(userProducts.userId, userId), eq(userProducts.isActive, true)));
    
    return result.map(r => ({
      ...r.userProduct,
      product: productTermsAtPurchase(r.product, r.userProduct),
    }));
  }

  async hasActiveStableProduct(userId: number): Promise<boolean> {
    const positions = await db.select({
      purchaseProductType: userProducts.purchaseProductType,
      currentProductType: products.productType,
      isActive: userProducts.isActive,
      isRevoked: userProducts.isRevoked,
      daysRemaining: userProducts.daysRemaining,
      assignedByAdmin: userProducts.assignedByAdmin,
    })
      .from(userProducts)
      .innerJoin(products, eq(userProducts.productId, products.id))
      .where(eq(userProducts.userId, userId));

    return hasQualifyingActiveStableProduct(positions);
  }

  async getAllUserProducts(userId: number): Promise<{ userProduct: UserProduct; product: Product }[]> {
    const result = await db.select({
      userProduct: userProducts,
      product: products,
    }).from(userProducts)
      .innerJoin(products, eq(userProducts.productId, products.id))
      .where(eq(userProducts.userId, userId));

    const hasLegacyRevocationCandidates = result.some(
      ({ userProduct }) => !userProduct.isActive && !userProduct.isRevoked,
    );
    const legacyRevocations = hasLegacyRevocationCandidates
      ? await db.select({
          details: adminAuditLog.details,
          revokedAt: adminAuditLog.createdAt,
        }).from(adminAuditLog).where(and(
          eq(adminAuditLog.action, "revoke_product"),
          eq(adminAuditLog.targetUserId, userId),
          sql`${adminAuditLog.details} ~ '^Produit [0-9]+ révoqué$'`,
        ))
      : [];
    const legacyRevocationEvents = legacyRevocations.flatMap((log) => {
      const match = /^Produit ([0-9]+) révoqué$/.exec(log.details);
      const productId = Number(match?.[1]);
      return match && Number.isInteger(productId)
        ? [{ productId, revokedAt: log.revokedAt }]
        : [];
    });

    return result.map((row) => ({
      userProduct: {
        ...row.userProduct,
        isRevoked: isUserProductRevoked(row.userProduct, legacyRevocationEvents),
      },
      product: productTermsAtPurchase(row.product, row.userProduct),
    })).sort((a, b) => {
      const dateA = a.userProduct.purchaseDate ? new Date(a.userProduct.purchaseDate).getTime() : 0;
      const dateB = b.userProduct.purchaseDate ? new Date(b.userProduct.purchaseDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  async purchaseProduct(
    userId: number,
    productId: number,
    assignedByAdmin = false,
    quantity = 1,
  ): Promise<UserProduct> {
    const purchase = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products)
        .where(eq(products.id, productId))
        .for("update");
      if (!product) throw new Error("Produit non trouvé");
      if (!assignedByAdmin && !product.isActive) {
        throw new Error("Ce produit n’est plus disponible.");
      }
      if (!isValidProductPurchaseQuantity(quantity, product.productType)) {
        if (product.productType === "activity" && typeof quantity === "number" && quantity > 1) {
          throw new Error("Un seul produit d’activité peut être acheté par lancement.");
        }
        if (product.productType === "wellness" && typeof quantity === "number" && quantity > 1) {
          throw new Error("Un seul produit Bien-être peut être acheté à la fois.");
        }
        throw new Error(`La quantité doit être comprise entre 1 et ${MAX_PRODUCT_PURCHASE_QUANTITY}.`);
      }
      const totalPrice = Number(product.price) * quantity;
      if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
        throw new Error("Le montant total de l’achat est invalide.");
      }

      const [user] = await tx.select().from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!user) throw new Error("Utilisateur non trouvé");

      if (!assignedByAdmin && ["activity", "wellness"].includes(product.productType)) {
        const priorPurchases = await tx.select({
          purchaseProductType: userProducts.purchaseProductType,
          currentProductType: products.productType,
          purchasePrice: userProducts.purchasePrice,
          currentPrice: products.price,
          isFree: products.isFree,
          isActive: userProducts.isActive,
          isRevoked: userProducts.isRevoked,
          daysRemaining: userProducts.daysRemaining,
          purchaseLaunchDate: userProducts.purchaseLaunchDate,
          purchaseLaunchTime: userProducts.purchaseLaunchTime,
          productLaunchDate: products.launchDate,
          productLaunchTime: products.launchTime,
          assignedByAdmin: userProducts.assignedByAdmin,
        }).from(userProducts)
          .innerJoin(products, eq(userProducts.productId, products.id))
          .where(eq(userProducts.userId, userId));
        const stablePurchases = priorPurchases.map((row) => ({
          productType: row.purchaseProductType ?? row.currentProductType,
          purchasePrice: row.purchasePrice,
          productPrice: row.currentPrice,
          isFree: row.isFree,
          assignedByAdmin: row.assignedByAdmin,
        }));
        if (!hasPurchasedStableProduct(stablePurchases)) {
          const category = product.productType === "activity" ? "d’activité" : "Bien-être";
          throw new Error(`Vous devez d’abord acheter un produit stable avant de pouvoir acheter un produit ${category}.`);
        }
        const highestStablePurchasePrice = getHighestStablePurchasePrice(stablePurchases);
        if (highestStablePurchasePrice == null) {
          throw new Error("Impossible de vérifier le plafond d’achat lié à votre produit stable. Contactez le service client.");
        }
        if (!isProductWithinStablePurchaseLimit(product.price, stablePurchases)) {
          const category = product.productType === "activity" ? "d’activité" : "Bien-être";
          throw new Error(
            `Le prix de ce produit ${category} dépasse votre plafond de ${highestStablePurchasePrice.toLocaleString("fr-FR")} FCFA. Achetez un produit stable d’un montant supérieur ou égal pour débloquer ce produit.`,
          );
        }
        if (product.productType === "activity"
          && hasPurchasedActivityLaunch(product.launchDate, product.launchTime, priorPurchases.map((row) => ({
            productType: row.purchaseProductType ?? row.currentProductType,
            launchDate: row.purchaseLaunchDate ?? row.productLaunchDate,
            launchTime: row.purchaseLaunchTime ?? row.productLaunchTime,
            assignedByAdmin: row.assignedByAdmin,
          })))) {
          throw new Error("Vous avez déjà acheté un produit d’activité pour ce lancement. Vous pourrez en acheter un autre au prochain lancement.");
        }
        if (product.productType === "wellness" && hasActiveWellnessProduct(priorPurchases.map((row) => ({
          productType: row.purchaseProductType ?? row.currentProductType,
          isActive: row.isActive,
          isRevoked: row.isRevoked,
          daysRemaining: row.daysRemaining,
        })))) {
          throw new Error("Vous avez déjà un produit Bien-être en cours. Vous pourrez en acheter un autre à la fin de sa période.");
        }
      }

      if (!assignedByAdmin && !product.isFree && product.stockLimit != null) {
        const [countRow] = await tx.select({
          count: sql<number>`count(distinct ${userProducts.userId})::int`,
        }).from(userProducts).where(and(
          eq(userProducts.productId, productId),
          eq(userProducts.assignedByAdmin, false),
        ));
        const stockCount = Number(countRow?.count ?? 0);
        if (isProductStockFull(product.stockLimit, stockCount)) {
          throw new Error("Ce produit est complet. Toutes les places disponibles ont été prises.");
        }
      }

      const isPaidPurchase = !product.isFree && !assignedByAdmin;
      let isFirstStableProductPurchase = false;
      if (isPaidPurchase) {
        if (product.productType === "stable") {
          const previousPurchases = await tx.select({
            purchaseProductType: userProducts.purchaseProductType,
            currentProductType: products.productType,
            purchasePrice: userProducts.purchasePrice,
            currentPrice: products.price,
            isFree: products.isFree,
            assignedByAdmin: userProducts.assignedByAdmin,
          })
          .from(userProducts)
          .innerJoin(products, eq(userProducts.productId, products.id))
          .where(eq(userProducts.userId, userId));

          isFirstStableProductPurchase = isFirstPaidStableProductPurchase(
            product.productType,
            isPaidPurchase,
            assignedByAdmin,
            previousPurchases.map((purchase) => ({
              productType: purchase.purchaseProductType ?? purchase.currentProductType,
              purchasePrice: purchase.purchasePrice,
              productPrice: purchase.currentPrice,
              isFree: purchase.isFree,
              assignedByAdmin: purchase.assignedByAdmin,
            })),
          );
        }

        const balance = Number(user.depositBalance);
        if (!Number.isFinite(balance) || balance < totalPrice) {
          throw new Error("Solde insuffisant");
        }
        if (!await this.adjustBalance(userId, "deposit", -totalPrice, tx)) {
          throw new Error("Solde de dépôt insuffisant");
        }
        await tx.update(users).set({ hasActiveProduct: true }).where(eq(users.id, userId));
        await tx.insert(transactions).values({
          userId,
          type: "purchase",
          amount: (-totalPrice).toString(),
          description: quantity === 1
            ? `Achat ${product.name}`
            : `Achat ${product.name} × ${quantity}`,
        });
      } else {
        await tx.update(users)
          .set({ hasActiveProduct: true })
          .where(eq(users.id, userId));
      }

      const purchasedPositions = await tx.insert(userProducts).values(
        Array.from({ length: quantity }, () => ({
          userId,
          productId,
          daysRemaining: product.cycleDays,
          assignedByAdmin,
          lastEarningDate: new Date(),
          purchasePrice: product.price,
          purchaseDailyEarnings: product.dailyEarnings,
          purchaseCycleDays: product.cycleDays,
          purchaseTotalReturn: product.totalReturn,
          purchaseProductName: product.name,
          purchaseImageUrl: product.imageUrl,
          purchaseProductType: product.productType,
          purchaseLaunchDate: product.productType === "activity" ? product.launchDate : null,
          purchaseLaunchTime: product.productType === "activity" ? product.launchTime : null,
          payoutMode: getProductPayoutMode(product.productType),
          purchasePrepaidEarnings: 0,
        })),
      ).returning();
      const userProduct = purchasedPositions[0];

      const spinAwards = getStablePurchaseSpinAwards({
        productType: product.productType,
        isPaidPurchase,
        assignedByAdmin,
        isFirstStableProductPurchase,
        isReferred: Boolean(user.referredBy),
      });
      if (spinAwards.buyerSpins > 0) {
        await tx.update(users)
          .set({
            fortuneWheelSpins: sql`${users.fortuneWheelSpins} + ${spinAwards.buyerSpins * quantity}`,
          })
          .where(eq(users.id, userId));
      }
      if (spinAwards.sponsorSpins > 0 && user.referredBy && user.referredBy !== user.referralCode) {
        await tx.update(users)
          .set({ fortuneWheelSpins: sql`${users.fortuneWheelSpins} + ${spinAwards.sponsorSpins}` })
          .where(eq(users.referralCode, user.referredBy));
      }

      if (isFirstStableProductPurchase) {
        await this.processReferralCommissionsWithExecutor(
          tx,
          userId,
          product.price,
          productId,
          user.fullName,
        );
      }

      return { product, userProduct, isFirstStableProductPurchase };
    });

    return purchase.userProduct;
  }

  async updateUserProduct(id: number, data: Partial<UserProduct>): Promise<UserProduct> {
    const [updated] = await db.update(userProducts)
      .set(data as any)
      .where(eq(userProducts.id, id))
      .returning();
    return updated;
  }

  async removeUserProduct(userId: number, productId: number): Promise<void> {
    await db.update(userProducts)
      .set({ isActive: false, isRevoked: true })
      .where(and(eq(userProducts.userId, userId), eq(userProducts.productId, productId)));
  }

  private async processReferralCommissionsWithExecutor(
    executor: any,
    userId: number,
    amount: number,
    productId: number,
    buyerName: string,
  ): Promise<void> {
    const [buyer] = await executor.select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!buyer?.referredBy) return;

    const settingRows = await executor.select({
      key: platformSettings.key,
      value: platformSettings.value,
    }).from(platformSettings);
    const settings = Object.fromEntries(
      settingRows.map((row: { key: string; value: string }) => [row.key, row.value]),
    );
    const rates = [
      parseFloat(settings.level1Commission || "27") / 100,
      parseFloat(settings.level2Commission || "2") / 100,
      parseFloat(settings.level3Commission || "1") / 100,
    ];
    let referralCode: string | null = buyer.referredBy;

    for (let level = 1; level <= rates.length && referralCode; level += 1) {
      const [referrer] = await executor.select({
        id: users.id,
        referredBy: users.referredBy,
      }).from(users).where(eq(users.referralCode, referralCode)).limit(1);
      if (!referrer) break;
      const commission = Math.round(amount * rates[level - 1] * 100) / 100;
      if (commission > 0) {
        if (!await this.adjustBalance(referrer.id, "withdrawal", commission, executor)) {
          throw new Error("Impossible de créditer une commission de parrainage.");
        }
        await executor.insert(referralCommissions).values({
          userId: referrer.id,
          fromUserId: userId,
          level,
          amount: commission.toFixed(2),
          productId,
        });
        await executor.insert(transactions).values({
          userId: referrer.id,
          type: "commission",
          amount: commission.toFixed(2),
          description: level === 1
            ? `Commission niveau 1 de ${buyerName}`
            : `Commission niveau ${level}`,
        });
      }
      referralCode = referrer.referredBy;
    }
  }

  async processEarnings(): Promise<void> {
    const activeProducts = await db.select({
      userProduct: userProducts,
      product: products,
      user: users,
    }).from(userProducts)
      .innerJoin(products, eq(userProducts.productId, products.id))
      .innerJoin(users, eq(userProducts.userId, users.id))
      .where(and(eq(userProducts.isActive, true), sql`${userProducts.daysRemaining} > 0`));

    const now = new Date();
    const creditWithdrawalEarnings = async (
      tx: any,
      userId: number,
      amount: number,
      description: string,
    ) => {
      if (amount <= 0) return;
      await this.adjustBalance(userId, "withdrawal", amount, tx);
      await tx.update(users).set({
        todayEarnings: sql`${users.todayEarnings} + ${amount}`,
        totalEarnings: sql`${users.totalEarnings} + ${amount}`,
      }).where(eq(users.id, userId));
      await tx.insert(transactions).values({
        userId,
        type: "earning",
        amount: amount.toFixed(2),
        description,
      });
    };

    for (const { userProduct, product, user } of activeProducts) {
      try {
        const purchaseDate = userProduct.purchaseDate ? new Date(userProduct.purchaseDate) : null;
        if (!purchaseDate) continue;

        const lastEarning = userProduct.lastEarningDate ? new Date(userProduct.lastEarningDate) : purchaseDate;
        const msSincePurchase = now.getTime() - purchaseDate.getTime();
        const daysSincePurchase = Math.floor(msSincePurchase / (24 * 60 * 60 * 1000));
        const msSinceLastEarning = now.getTime() - lastEarning.getTime();
        const cyclesSinceLastEarning = Math.floor(msSinceLastEarning / (24 * 60 * 60 * 1000));
        const dailyEarnings = Number(userProduct.purchaseDailyEarnings ?? product.dailyEarnings);
        const cycleDays = Number(userProduct.purchaseCycleDays ?? product.cycleDays);
        const productType = userProduct.purchaseProductType ?? product.productType;
        const productName = userProduct.purchaseProductName ?? product.name;

        const totalReturn = Number(
          userProduct.purchaseTotalReturn ?? product.totalReturn ?? dailyEarnings * cycleDays,
        );
        const accruedSoFar = Math.min(totalReturn, Math.max(0, Number(userProduct.totalEarned || 0)));
        const prepaidEarnings = Math.min(
          totalReturn,
          Math.max(
            0,
            Number(userProduct.purchasePrepaidEarnings ?? (
              userProduct.payoutMode === "daily" ? accruedSoFar : 0
            )),
          ),
        );
        const expectedPayoutMode = getProductPayoutMode(productType);
        const positionCondition = and(
          eq(userProducts.id, userProduct.id),
          eq(userProducts.isActive, true),
          eq(userProducts.payoutMode, userProduct.payoutMode),
          userProduct.lastEarningDate
            ? eq(userProducts.lastEarningDate, userProduct.lastEarningDate)
            : isNull(userProducts.lastEarningDate),
        );

        if (cycleDays < 1) continue;

        if (userProduct.payoutMode !== expectedPayoutMode || userProduct.purchasePrepaidEarnings == null) {
          const alreadyPaid = userProduct.purchasePrepaidEarnings == null
            ? userProduct.payoutMode === "daily" ? accruedSoFar : 0
            : prepaidEarnings;
          const migrationCatchUp = expectedPayoutMode === "daily"
            ? calculateDailyPayoutCatchUp(accruedSoFar, alreadyPaid)
            : 0;
          const normalizedPaid = Math.min(
            totalReturn,
            Math.max(accruedSoFar, alreadyPaid),
          );

          await db.transaction(async (tx) => {
            const [normalizedPosition] = await tx.update(userProducts)
              .set({
                payoutMode: expectedPayoutMode,
                purchasePrepaidEarnings: normalizedPaid,
                totalEarned: normalizedPaid.toFixed(2),
              })
              .where(positionCondition)
              .returning({ id: userProducts.id });

            if (!normalizedPosition) return;
            await creditWithdrawalEarnings(
              tx,
              user.id,
              migrationCatchUp,
              `Rattrapage des gains journaliers — ${productName}`,
            );
          });
          continue;
        }

        if (cyclesSinceLastEarning < 1) continue;

        const cyclesToAccrue = Math.min(cyclesSinceLastEarning, userProduct.daysRemaining);
        if (cyclesToAccrue < 1) continue;

        const newDaysRemaining = Math.max(0, userProduct.daysRemaining - cyclesToAccrue);
        const newLastEarningDate = new Date(lastEarning.getTime() + cyclesToAccrue * 24 * 60 * 60 * 1000);
        const newTotalEarned = Math.min(totalReturn, accruedSoFar + dailyEarnings * cyclesToAccrue);
        const completesCycle = daysSincePurchase >= cycleDays || newDaysRemaining === 0;

        if (userProduct.payoutMode === "daily") {
          const payoutAmount = calculateDailyProductPayout(
            totalReturn,
            prepaidEarnings,
            dailyEarnings,
            cyclesToAccrue,
            completesCycle,
          );
          const newPaidEarnings = Math.min(totalReturn, prepaidEarnings + payoutAmount);
          const maturityDate = new Date(purchaseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

          await db.transaction(async (tx) => {
            const [paidPosition] = await tx.update(userProducts)
              .set({
                payoutMode: "daily",
                purchasePrepaidEarnings: newPaidEarnings,
                lastEarningDate: completesCycle ? maturityDate : newLastEarningDate,
                daysRemaining: newDaysRemaining,
                totalEarned: newPaidEarnings.toFixed(2),
                isActive: !completesCycle,
              })
              .where(positionCondition)
              .returning({ id: userProducts.id });

            if (!paidPosition) return;
            await creditWithdrawalEarnings(
              tx,
              user.id,
              payoutAmount,
              `Gains journaliers — ${productName}`,
            );
          });
          continue;
        }

        if (completesCycle) {
          const maturityDate = new Date(purchaseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);
          const payoutAmount = calculateMaturityPayout(totalReturn, prepaidEarnings);
          await db.transaction(async (tx) => {
            const [completedPosition] = await tx.update(userProducts)
              .set({
                payoutMode: "maturity",
                purchasePrepaidEarnings: prepaidEarnings,
                lastEarningDate: maturityDate,
                daysRemaining: 0,
                totalEarned: totalReturn.toFixed(2),
                isActive: false,
              })
              .where(positionCondition)
              .returning({ id: userProducts.id });

            if (!completedPosition || payoutAmount <= 0) return;

            await creditWithdrawalEarnings(
              tx,
              user.id,
              payoutAmount,
              `Gains à l’échéance — ${productName}`,
            );
          });
        } else {
          await db.update(userProducts)
            .set({
              payoutMode: "maturity",
              purchasePrepaidEarnings: prepaidEarnings,
              lastEarningDate: newLastEarningDate,
              daysRemaining: newDaysRemaining,
              totalEarned: newTotalEarned.toFixed(2),
            })
            .where(positionCondition);
        }
      } catch (productError) {
        console.error(`processEarnings error for product ${userProduct.id}:`, productError);
      }
    }

  }

  // Deposits
  async createDeposit(data: Partial<Deposit>): Promise<Deposit> {
    const [deposit] = await db.insert(deposits).values(data as any).returning();
    return deposit;
  }

  async getDeposit(id: number): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.id, id));
    return deposit;
  }

  async getDepositBySendavapayReference(reference: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.sendavapayReference, reference));
    return deposit;
  }

  async getDepositByDrimPayReference(reference: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.drimpayReference, reference));
    return deposit;
  }

  async getDepositByDrimPayOrderId(orderId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.drimpayOrderId, orderId));
    return deposit;
  }

  async getDepositByInpayOutTradeNo(reference: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.inpayOutTradeNo, reference));
    return deposit;
  }

  async getDepositByWestpayReference(reference: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.westpayReference, reference));
    return deposit;
  }

  async getDepositByAshtechReference(reference: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.ashtechReference, reference));
    return deposit;
  }

  async getDepositByAshtechTransactionId(transactionId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.ashtechTransactionId, transactionId));
    return deposit;
  }

  async getPendingAshtechDeposits(): Promise<Deposit[]> {
    return db.select().from(deposits).where(and(
      sql`${deposits.ashtechTransactionId} IS NOT NULL`,
      or(eq(deposits.status, "pending"), eq(deposits.status, "processing")),
    ));
  }

  async getPendingDrimPayDeposits(): Promise<Deposit[]> {
    return db.select().from(deposits).where(and(
      sql`${deposits.drimpayOrderId} IS NOT NULL`,
      sql`${deposits.drimpayReference} IS NOT NULL`,
      or(eq(deposits.status, "pending"), eq(deposits.status, "processing")),
    ));
  }

  async incrementDrimPayStatusCheckCount(depositId: number): Promise<number> {
    const key = `${DRIMPAY_STATUS_CHECK_SETTING_PREFIX}${depositId}`;
    const [counter] = await db.insert(platformSettings).values({
      key,
      value: "1",
      modifiedAt: new Date(),
    }).onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: sql`(${platformSettings.value}::integer + 1)::text`,
        modifiedAt: new Date(),
      },
    }).returning({ value: platformSettings.value });
    return Number(counter.value);
  }

  async clearDrimPayStatusCheckCount(depositId: number): Promise<void> {
    const key = `${DRIMPAY_STATUS_CHECK_SETTING_PREFIX}${depositId}`;
    await db.delete(platformSettings).where(eq(platformSettings.key, key));
  }

  async approveDepositAndCredit(
    id: number,
    processedBy?: number,
    description?: string,
  ): Promise<Deposit | undefined> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const [deposit] = await tx.update(deposits)
        .set({ status: "approved", processedAt: now, processedBy: processedBy ?? null })
        .where(and(
          eq(deposits.id, id),
          inArray(deposits.status, ["pending", "processing"]),
          isNull(deposits.processedAt),
        ))
        .returning();
      if (!deposit) return undefined;

      const amount = Number(deposit.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Montant du dépôt invalide.");
      }
      if (!await this.adjustBalance(deposit.userId, "deposit", amount, tx)) {
        throw new Error("Impossible de créditer le dépôt.");
      }
      const [creditedUser] = await tx.update(users)
        .set({ hasDeposited: true })
        .where(eq(users.id, deposit.userId))
        .returning({ id: users.id });
      if (!creditedUser) throw new Error("Utilisateur du dépôt introuvable.");

      await tx.insert(transactions).values({
        userId: deposit.userId,
        type: "deposit",
        amount: amount.toFixed(2),
        description: description || `Dépôt #${deposit.id} approuvé`,
        createdAt: now,
      });
      await this.processDepositReferralCommissionsWithExecutor(tx, deposit.userId, amount);
      if (processedBy) {
        await tx.insert(adminAuditLog).values({
          adminId: processedBy,
          action: "approve_deposit",
          targetUserId: deposit.userId,
          details: `Dépôt ${deposit.id} approuvé — ${amount} FCFA`,
        });
      }
      return deposit;
    });
  }

  async rejectDeposit(
    id: number,
    processedBy?: number,
    clearScreenshot = false,
  ): Promise<Deposit | undefined> {
    return db.transaction(async (tx) => {
      const [deposit] = await tx.update(deposits)
        .set({
          status: "rejected",
          processedAt: new Date(),
          processedBy: processedBy ?? null,
          ...(clearScreenshot ? { screenshot: null } : {}),
        })
        .where(and(
          eq(deposits.id, id),
          inArray(deposits.status, ["pending", "processing"]),
          isNull(deposits.processedAt),
        ))
        .returning();
      if (deposit && processedBy) {
        await tx.insert(adminAuditLog).values({
          adminId: processedBy,
          action: "reject_deposit",
          targetUserId: deposit.userId,
          details: `Dépôt ${deposit.id} rejeté — ${deposit.amount} FCFA`,
        });
      }
      return deposit;
    });
  }

  async setDepositNonterminalStatus(
    id: number,
    status: "pending" | "processing",
    data: Partial<Deposit> = {},
  ): Promise<Deposit | undefined> {
    const safeData = pickProviderMetadata(data, DEPOSIT_PROVIDER_METADATA_FIELDS);
    const [deposit] = await db.update(deposits)
      .set({ ...safeData, status })
      .where(and(
        eq(deposits.id, id),
        inArray(deposits.status, ["pending", "processing"]),
        isNull(deposits.processedAt),
      ))
      .returning();
    return deposit;
  }

  async getDeposits(status?: string): Promise<(Deposit & { user: User })[]> {
    let query = db.select({
      deposit: deposits,
      user: users,
    }).from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id))
      .orderBy(desc(deposits.createdAt));
    
    if (status && status !== "all") {
      query = query.where(eq(deposits.status, status)) as any;
    }
    
    const result = await query;
    return result.map(r => ({ ...r.deposit, user: r.user }));
  }

  async getUserDeposits(userId: number): Promise<Deposit[]> {
    return await db.select().from(deposits).where(eq(deposits.userId, userId)).orderBy(desc(deposits.createdAt));
  }

  async getUserApprovedDepositTotal(userId: number): Promise<number> {
    const summary = await getApprovedDepositSummary([userId]);
    return summary.amount;
  }

  async getUserVipQualifyingTotal(userId: number): Promise<number> {
    const [depositSummary, creditSummary] = await Promise.all([
      getApprovedDepositSummary([userId]),
      db.select({
        amount: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          inArray(transactions.type, [...VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES]),
          sql`${transactions.amount} > 0`,
        ))
        .then((rows) => rows[0]),
    ]);

    return depositSummary.amount + Number(creditSummary?.amount ?? 0);
  }

  async updateDeposit(id: number, data: Partial<Deposit>): Promise<Deposit> {
    const safeData = pickProviderMetadata(data, DEPOSIT_PROVIDER_METADATA_FIELDS);
    const [deposit] = await db.update(deposits).set(safeData).where(eq(deposits.id, id)).returning();
    if (!deposit) throw new Error("Dépôt introuvable.");
    return deposit;
  }

  async cleanupDepositScreenshots(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.update(deposits)
      .set({ screenshot: null })
      .where(
        and(
          sql`${deposits.screenshot} IS NOT NULL`,
          or(
            and(eq(deposits.status, "approved"), lte(deposits.processedAt, cutoff)),
            and(eq(deposits.status, "rejected"), lte(deposits.processedAt, cutoff)),
          )
        )
      );
  }

  private async processDepositReferralCommissionsWithExecutor(
    executor: any,
    userId: number,
    amount: number,
  ): Promise<void> {
    const [member] = await executor.select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!member?.referredBy) return;

    const settingRows = await executor.select({
      key: platformSettings.key,
      value: platformSettings.value,
    }).from(platformSettings);
    const settings = Object.fromEntries(
      settingRows.map((row: { key: string; value: string }) => [row.key, row.value]),
    );
    const rates = [
      parseFloat(settings.depositCommissionLevel1 || "5") / 100,
      parseFloat(settings.depositCommissionLevel2 || "2") / 100,
      parseFloat(settings.depositCommissionLevel3 || "1") / 100,
    ];
    const getReferrer = async (code: string) => {
      const [referrer] = await executor.select({
        id: users.id,
        referredBy: users.referredBy,
      }).from(users).where(eq(users.referralCode, code)).limit(1);
      return referrer;
    };

    let referralCode: string | null = member.referredBy;
    for (let level = 1; level <= rates.length && referralCode; level += 1) {
      const referrer = await getReferrer(referralCode);
      if (!referrer) break;
      const commission = Math.round(amount * rates[level - 1]);
      if (commission > 0) {
        if (!await this.adjustBalance(referrer.id, "withdrawal", commission, executor)) {
          throw new Error("Impossible de créditer une commission de dépôt.");
        }
        await executor.insert(transactions).values({
          userId: referrer.id,
          type: "deposit_commission",
          amount: commission.toFixed(2),
          description: `Commission dépôt niveau ${level}`,
        });
      }
      referralCode = referrer.referredBy;
    }
  }

  // Withdrawals
  async reserveWithdrawal(
    userId: number,
    amount: number,
    data: Partial<Withdrawal>,
  ): Promise<Withdrawal | undefined> {
    return db.transaction(async (tx) => {
      if (!await this.adjustBalance(userId, "withdrawal", -amount, tx)) return undefined;
      const [withdrawal] = await tx.insert(withdrawals).values({
        ...data,
        userId,
        amount,
      } as any).returning();
      return withdrawal;
    });
  }

  async getWithdrawals(status?: string): Promise<(Withdrawal & { user: User })[]> {
    let query = db.select({
      withdrawal: withdrawals,
      user: users,
    }).from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id))
      .orderBy(desc(withdrawals.createdAt));
    
    if (status && status !== "all") {
      query = query.where(eq(withdrawals.status, status)) as any;
    }
    
    const result = await query;
    return result.map(r => ({ ...r.withdrawal, user: r.user }));
  }

  async getUserWithdrawals(userId: number): Promise<Withdrawal[]> {
    return await db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
  }

  async getWithdrawal(id: number): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
    return withdrawal;
  }

  async getWithdrawalByInpayOutTradeNo(reference: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.inpayOutTradeNo, reference));
    return withdrawal;
  }

  async claimInpayWithdrawal(id: number, outTradeNo: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "processing", inpayOutTradeNo: outTradeNo })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "pending"),
        isNull(withdrawals.inpayOutTradeNo),
      ))
      .returning();
    return withdrawal;
  }

  async releaseInpayWithdrawal(id: number, outTradeNo: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "pending", inpayOutTradeNo: null, inpayOrderNumber: null })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "processing"),
        eq(withdrawals.inpayOutTradeNo, outTradeNo),
      ))
      .returning();
    return withdrawal;
  }

  async getWithdrawalByDrimPayReference(reference: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.select().from(withdrawals).where(or(
      eq(withdrawals.drimpayReference, reference),
      eq(withdrawals.drimpayExternalRef, reference),
    ));
    return withdrawal;
  }

  async claimDrimPayWithdrawal(id: number, externalRef: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "processing", drimpayExternalRef: externalRef, drimpayReference: null })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "pending"),
        isNull(withdrawals.drimpayExternalRef),
      ))
      .returning();
    return withdrawal;
  }

  async releaseDrimPayWithdrawal(id: number, externalRef: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "pending", drimpayExternalRef: null, drimpayReference: null })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "processing"),
        eq(withdrawals.drimpayExternalRef, externalRef),
      ))
      .returning();
    return withdrawal;
  }

  async claimPpayProsWithdrawal(id: number, merchantOrderNo: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "processing", omnipayReference: merchantOrderNo, omnipayId: null })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "pending"),
        isNull(withdrawals.omnipayReference),
      ))
      .returning();
    return withdrawal;
  }

  async releasePpayProsWithdrawal(id: number, merchantOrderNo: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db.update(withdrawals)
      .set({ status: "pending", omnipayReference: null, omnipayId: null })
      .where(and(
        eq(withdrawals.id, id),
        eq(withdrawals.status, "processing"),
        eq(withdrawals.omnipayReference, merchantOrderNo),
      ))
      .returning();
    return withdrawal;
  }

  async finalizeWithdrawal(
    id: number,
    status: "approved" | "rejected",
    processedBy?: number,
    details: Partial<Withdrawal> = {},
    _refundProvider?: string,
    allowedStatuses: Array<"pending" | "processing"> = ["pending", "processing"],
  ): Promise<Withdrawal | undefined> {
    const safeDetails = pickProviderMetadata(details, WITHDRAWAL_PROVIDER_METADATA_FIELDS);
    return db.transaction(async (tx) => {
      const now = new Date();
      const [withdrawal] = await tx.update(withdrawals)
        .set({
          ...safeDetails,
          status,
          processedAt: now,
          processedBy: processedBy ?? null,
        })
        .where(and(
          eq(withdrawals.id, id),
          inArray(withdrawals.status, allowedStatuses),
          isNull(withdrawals.processedAt),
        ))
        .returning();
      if (!withdrawal) return undefined;

      if (status === "rejected") {
        const amount = Number(withdrawal.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Montant du retrait invalide.");
        }
        if (!await this.adjustBalance(withdrawal.userId, "withdrawal", amount, tx)) {
          throw new Error("Impossible de rembourser le retrait.");
        }
        await tx.insert(transactions).values({
          userId: withdrawal.userId,
          type: "withdrawal_refund",
          amount: amount.toFixed(2),
          description: `Remboursement du retrait #${withdrawal.id}`,
          createdAt: now,
        });
      }
      if (processedBy) {
        await tx.insert(adminAuditLog).values({
          adminId: processedBy,
          action: status === "approved" ? "approve_withdrawal" : "reject_withdrawal",
          targetUserId: withdrawal.userId,
          details: `Retrait ${withdrawal.id} ${status === "approved" ? "approuvé" : "rejeté"} — ${withdrawal.amount} FCFA`,
        });
      }
      return withdrawal;
    });
  }

  async setWithdrawalProcessing(
    id: number,
    data: Partial<Withdrawal> = {},
  ): Promise<Withdrawal | undefined> {
    const safeData = pickProviderMetadata(data, WITHDRAWAL_PROVIDER_METADATA_FIELDS);
    const [withdrawal] = await db.update(withdrawals)
      .set({ ...safeData, status: "processing" })
      .where(and(
        eq(withdrawals.id, id),
        inArray(withdrawals.status, ["pending", "processing"]),
        isNull(withdrawals.processedAt),
      ))
      .returning();
    return withdrawal;
  }

  async updateWithdrawal(id: number, data: Partial<Withdrawal>): Promise<Withdrawal> {
    const safeData = pickProviderMetadata(data, WITHDRAWAL_PROVIDER_METADATA_FIELDS);
    const [withdrawal] = await db.update(withdrawals).set(safeData).where(eq(withdrawals.id, id)).returning();
    if (!withdrawal) throw new Error("Retrait introuvable.");
    return withdrawal;
  }

  async getUserWithdrawalCountToday(userId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(withdrawals)
      .where(and(
        eq(withdrawals.userId, userId),
        gte(withdrawals.createdAt, today)
      ));
    
    return result[0]?.count || 0;
  }

  // Wallets
  async getWallets(userId: number): Promise<WithdrawalWallet[]> {
    return await db.select().from(withdrawalWallets).where(eq(withdrawalWallets.userId, userId));
  }

  async createWallet(data: Partial<WithdrawalWallet>): Promise<WithdrawalWallet> {
    const userId = data.userId!;
    const existingWallets = await this.getWallets(userId);
    const existing = existingWallets.find((wallet) => wallet.isDefault) ?? existingWallets[0];

    if (existing) {
      const [wallet] = await db.update(withdrawalWallets)
        .set({
          accountName: data.accountName!,
          accountNumber: data.accountNumber!,
          paymentMethod: data.paymentMethod!,
          country: data.country!,
          isDefault: true,
        })
        .where(and(
          eq(withdrawalWallets.id, existing.id),
          eq(withdrawalWallets.userId, userId),
        ))
        .returning();

      if (!wallet) throw new Error("Compte de retrait introuvable");

      await db.update(withdrawalWallets)
        .set({ isDefault: false })
        .where(and(
          eq(withdrawalWallets.userId, userId),
          ne(withdrawalWallets.id, existing.id),
        ));

      return wallet;
    }

    const [wallet] = await db.insert(withdrawalWallets)
      .values({ ...data, isDefault: true } as any)
      .returning();
    return wallet;
  }

  async deleteWallet(userId: number, id: number): Promise<boolean> {
    const deleted = await db.delete(withdrawalWallets)
      .where(and(eq(withdrawalWallets.id, id), eq(withdrawalWallets.userId, userId)))
      .returning({ id: withdrawalWallets.id });
    return deleted.length > 0;
  }

  async setDefaultWallet(userId: number, walletId: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [wallet] = await tx.select({ id: withdrawalWallets.id })
        .from(withdrawalWallets)
        .where(and(eq(withdrawalWallets.id, walletId), eq(withdrawalWallets.userId, userId)))
        .limit(1);
      if (!wallet) throw new Error("Compte de retrait introuvable.");

      await tx.update(withdrawalWallets)
        .set({ isDefault: false })
        .where(eq(withdrawalWallets.userId, userId));
      await tx.update(withdrawalWallets)
        .set({ isDefault: true })
        .where(and(eq(withdrawalWallets.id, walletId), eq(withdrawalWallets.userId, userId)));
    });
  }

  async getDefaultWallet(userId: number): Promise<WithdrawalWallet | undefined> {
    const [wallet] = await db.select().from(withdrawalWallets)
      .where(and(eq(withdrawalWallets.userId, userId), eq(withdrawalWallets.isDefault, true)));
    return wallet || undefined;
  }

  // Payment Channels
  async getPaymentChannels(): Promise<PaymentChannel[]> {
    return await db.select().from(paymentChannels);
  }

  async getActivePaymentChannels(): Promise<PaymentChannel[]> {
    return await db.select().from(paymentChannels).where(eq(paymentChannels.isActive, true));
  }

  async getPaymentChannel(id: number): Promise<PaymentChannel | undefined> {
    const [channel] = await db.select().from(paymentChannels).where(eq(paymentChannels.id, id));
    return channel || undefined;
  }

  async createPaymentChannel(data: Partial<PaymentChannel>): Promise<PaymentChannel> {
    const [channel] = await db.insert(paymentChannels).values(data as any).returning();
    return channel;
  }

  async updatePaymentChannel(id: number, data: Partial<PaymentChannel>): Promise<PaymentChannel> {
    const [channel] = await db.update(paymentChannels).set({ ...data, modifiedAt: new Date() }).where(eq(paymentChannels.id, id)).returning();
    return channel;
  }

  async deletePaymentChannel(id: number): Promise<void> {
    await db.delete(paymentChannels).where(eq(paymentChannels.id, id));
  }

  // Referrals
  async getReferrals(userId: number, level: number): Promise<User[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    if (level === 1) {
      return await db.select().from(users).where(eq(users.referredBy, user.referralCode));
    }
    
    // For level 2 and 3, we need recursive queries
    const level1 = await this.getReferrals(userId, 1);
    if (level === 2) {
      const level2: User[] = [];
      for (const l1 of level1) {
        const refs = await db.select().from(users).where(eq(users.referredBy, l1.referralCode));
        level2.push(...refs);
      }
      return level2;
    }
    
    if (level === 3) {
      const level2 = await this.getReferrals(userId, 2);
      const level3: User[] = [];
      for (const l2 of level2) {
        const refs = await db.select().from(users).where(eq(users.referredBy, l2.referralCode));
        level3.push(...refs);
      }
      return level3;
    }
    
    return [];
  }

  async createReferralCommission(data: Partial<ReferralCommission>): Promise<ReferralCommission> {
    const [commission] = await db.insert(referralCommissions).values(data as any).returning();
    return commission;
  }

  async getUserCommissions(userId: number): Promise<number> {
    const result = await db.select({ total: sql<string>`COALESCE(SUM(${referralCommissions.amount}), 0)` })
      .from(referralCommissions)
      .where(eq(referralCommissions.userId, userId));
    return parseFloat(result[0]?.total || "0");
  }

  async getTeamStatsSimple(userId: number): Promise<{ level1Count: number; level2Count: number; level3Count: number; totalCommission: number }> {
    const user = await this.getUser(userId);
    if (!user) return { level1Count: 0, level2Count: 0, level3Count: 0, totalCommission: 0 };

    const level1Result = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.referredBy, user.referralCode));
    const level1Count = Number(level1Result[0]?.count || 0);

    let level2Count = 0;
    let level3Count = 0;
    
    if (level1Count > 0) {
      const level1Codes = await db.select({ code: users.referralCode })
        .from(users)
        .where(eq(users.referredBy, user.referralCode));
      
      if (level1Codes.length > 0) {
        const level2Result = await db.select({ count: sql<number>`count(*)` })
          .from(users)
          .where(sql`${users.referredBy} IN (${sql.join(level1Codes.map(u => sql`${u.code}`), sql`, `)})`);
        level2Count = Number(level2Result[0]?.count || 0);
        
        if (level2Count > 0) {
          const level2Codes = await db.select({ code: users.referralCode })
            .from(users)
            .where(sql`${users.referredBy} IN (${sql.join(level1Codes.map(u => sql`${u.code}`), sql`, `)})`);
          
          if (level2Codes.length > 0) {
            const level3Result = await db.select({ count: sql<number>`count(*)` })
              .from(users)
              .where(sql`${users.referredBy} IN (${sql.join(level2Codes.map(u => sql`${u.code}`), sql`, `)})`);
            level3Count = Number(level3Result[0]?.count || 0);
          }
        }
      }
    }

    const commResult = await db.select({ total: sql<string>`COALESCE(SUM(${referralCommissions.amount}), 0)` })
      .from(referralCommissions)
      .where(eq(referralCommissions.userId, userId));
    const totalCommission = parseFloat(commResult[0]?.total || "0");

    return { level1Count, level2Count, level3Count, totalCommission };
  }

  async getTeamStats(userId: number): Promise<{ level1Count: number; level2Count: number; level3Count: number; totalCommission: number; level1Commission: number; level2Commission: number; level3Commission: number; level1Invested: number; level2Invested: number; level3Invested: number; level1PaidProductUsers: number; level2PaidProductUsers: number; level3PaidProductUsers: number; level1Recharged: number; teamRechargeAmount: number; level1RechargeAmount: number; level2RechargeAmount: number; level3RechargeAmount: number }> {
    const level1 = await this.getReferrals(userId, 1);
    const level2 = await this.getReferrals(userId, 2);
    const level3 = await this.getReferrals(userId, 3);
    const totalCommission = await this.getUserCommissions(userId);
    const [level1Deposits, level2Deposits, level3Deposits] = await Promise.all([
      getApprovedDepositSummary(level1.map((u) => u.id)),
      getApprovedDepositSummary(level2.map((u) => u.id)),
      getApprovedDepositSummary(level3.map((u) => u.id)),
    ]);

    const getCommissionByLevel = async (level: number) => {
      const result = await db.select({ total: sql<string>`COALESCE(SUM(${referralCommissions.amount}), 0)` })
        .from(referralCommissions)
        .where(and(eq(referralCommissions.userId, userId), eq(referralCommissions.level, level)));
      return parseFloat(result[0]?.total || "0");
    };

    const countInvested = async (userList: User[]) => {
      let count = 0;
      for (const u of userList) {
        if (u.hasActiveProduct) count++;
      }
      return count;
    };

    const countPaidProductUsers = async (userList: User[]) => {
      const userIds = userList.map(({ id }) => id);
      if (userIds.length === 0) return 0;
      const purchases = await db.select({
        userId: userProducts.userId,
        purchasePrice: userProducts.purchasePrice,
        currentProductPrice: products.price,
        isFree: products.isFree,
        assignedByAdmin: userProducts.assignedByAdmin,
        isActive: userProducts.isActive,
      })
        .from(userProducts)
        .innerJoin(products, eq(userProducts.productId, products.id))
        .where(inArray(userProducts.userId, userIds));
      const summaries = summarizeTeamProductPurchases(purchases);
      return userIds.filter((id) => summaries.get(id)?.hasActivePurchasedProduct).length;
    };

    const countRecharged = async (userList: User[]) => {
      let count = 0;
      for (const u of userList) {
        const userDeposits = await db.select().from(deposits)
          .where(and(eq(deposits.userId, u.id), eq(deposits.status, "approved")));
        if (userDeposits.length > 0) count++;
      }
      return count;
    };

    return {
      level1Count: level1.length,
      level2Count: level2.length,
      level3Count: level3.length,
      totalCommission,
      level1Commission: await getCommissionByLevel(1),
      level2Commission: await getCommissionByLevel(2),
      level3Commission: await getCommissionByLevel(3),
      level1Invested: await countInvested(level1),
      level2Invested: await countInvested(level2),
      level3Invested: await countInvested(level3),
      level1PaidProductUsers: await countPaidProductUsers(level1),
      level2PaidProductUsers: await countPaidProductUsers(level2),
      level3PaidProductUsers: await countPaidProductUsers(level3),
      level1Recharged: await countRecharged(level1),
      teamRechargeAmount: level1Deposits.amount + level2Deposits.amount + level3Deposits.amount,
      level1RechargeAmount: level1Deposits.amount,
      level2RechargeAmount: level2Deposits.amount,
      level3RechargeAmount: level3Deposits.amount,
    };
  }

  async getDetailedTeam(userId: number, excludeAdminAssignedPurchases = false): Promise<any> {
    const level1 = await this.getReferrals(userId, 1);
    const level2 = await this.getReferrals(userId, 2);
    const level3 = await this.getReferrals(userId, 3);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const [level1DailyDeposits, level2DailyDeposits, level3DailyDeposits] = await Promise.all([
      getApprovedDepositSummary(level1.map((u) => u.id), startOfToday, startOfTomorrow),
      getApprovedDepositSummary(level2.map((u) => u.id), startOfToday, startOfTomorrow),
      getApprovedDepositSummary(level3.map((u) => u.id), startOfToday, startOfTomorrow),
    ]);

    const enrichUser = async (user: User) => {
      const [userProductsList, approvedDeposits, approvedWithdrawals] = await Promise.all([
        db.select({
          productName: products.name,
          productPrice: products.price,
          purchasePrice: userProducts.purchasePrice,
          isFree: products.isFree,
          assignedByAdmin: userProducts.assignedByAdmin,
          purchaseIsActive: userProducts.isActive,
          purchaseDate: userProducts.purchaseDate,
          isActive: userProducts.isActive,
          userId: userProducts.userId,
        })
          .from(userProducts)
          .innerJoin(products, eq(userProducts.productId, products.id))
          .where(eq(userProducts.userId, user.id)),
        getApprovedDepositSummary([user.id]),
        db.select({
          amount: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)`,
        })
          .from(withdrawals)
          .where(and(eq(withdrawals.userId, user.id), eq(withdrawals.status, "approved"))),
      ]);
      
      const purchaseSummaries = summarizeTeamProductPurchases(userProductsList.map((purchase) => ({
        userId: purchase.userId,
        purchasePrice: purchase.purchasePrice,
        currentProductPrice: purchase.productPrice,
        isFree: purchase.isFree,
        assignedByAdmin: purchase.assignedByAdmin,
        isActive: purchase.purchaseIsActive,
      })));
      const purchaseSummary = purchaseSummaries.get(user.id) ?? {
        totalInvested: 0,
        hasPurchasedProduct: false,
        hasActivePurchasedProduct: false,
      };
      const totalInvested = excludeAdminAssignedPurchases
        ? purchaseSummary.totalInvested
        : userProductsList.reduce((sum, purchase) => sum + purchase.productPrice, 0);
      const productsForResponse = excludeAdminAssignedPurchases
        ? userProductsList.filter((purchase) => !purchase.assignedByAdmin)
        : userProductsList;

      return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        country: user.country,
        balance: user.balance,
        hasActiveProduct: excludeAdminAssignedPurchases
          ? purchaseSummary.hasActivePurchasedProduct
          : user.hasActiveProduct,
        hasPurchasedProduct: purchaseSummary.hasPurchasedProduct,
        hasDeposited: user.hasDeposited,
        createdAt: user.createdAt,
        totalInvested,
        totalRecharged: approvedDeposits.amount,
        totalWithdrawn: Number(approvedWithdrawals[0]?.amount ?? 0),
        products: productsForResponse,
      };
    };

    const level1Details = await Promise.all(level1.map(enrichUser));
    const level2Details = await Promise.all(level2.map(enrichUser));
    const level3Details = await Promise.all(level3.map(enrichUser));
    const teamUserIds = [...level1, ...level2, ...level3].map((member) => member.id);
    const [approvedDepositRows, approvedWithdrawalRows] = teamUserIds.length
      ? await Promise.all([
          db.select({
            userId: deposits.userId,
            amount: sql<string>`COALESCE(SUM(${deposits.amount}), 0)`,
          })
            .from(deposits)
            .where(and(
              eq(deposits.status, "approved"),
              inArray(deposits.userId, teamUserIds),
            ))
            .groupBy(deposits.userId),
          db.select({
            userId: withdrawals.userId,
            amount: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)`,
          })
            .from(withdrawals)
            .where(and(
              eq(withdrawals.status, "approved"),
              inArray(withdrawals.userId, teamUserIds),
            ))
            .groupBy(withdrawals.userId),
        ])
      : [[], []] as const;
    const depositsByUserId = new Map(
      approvedDepositRows.map((row) => [row.userId, Number(row.amount || 0)]),
    );
    const withdrawalsByUserId = new Map(
      approvedWithdrawalRows.map((row) => [row.userId, Number(row.amount || 0)]),
    );
    const addPaymentTotals = (members: typeof level1Details) =>
      members.map((member) => ({
        ...member,
        totalRecharged: depositsByUserId.get(member.id) ?? 0,
        totalWithdrawn: withdrawalsByUserId.get(member.id) ?? 0,
      }));

    return {
      level1: addPaymentTotals(level1Details),
      level2: addPaymentTotals(level2Details),
      level3: addPaymentTotals(level3Details),
      totalLevel1Invested: level1Details.reduce((sum, u) => sum + u.totalInvested, 0),
      totalLevel2Invested: level2Details.reduce((sum, u) => sum + u.totalInvested, 0),
      totalLevel3Invested: level3Details.reduce((sum, u) => sum + u.totalInvested, 0),
      level1DailyRechargeAmount: level1DailyDeposits.amount,
      level2DailyRechargeAmount: level2DailyDeposits.amount,
      level3DailyRechargeAmount: level3DailyDeposits.amount,
      level1DailyRechargeCount: level1DailyDeposits.count,
      level2DailyRechargeCount: level2DailyDeposits.count,
      level3DailyRechargeCount: level3DailyDeposits.count,
    };
  }

  // Blog
  async getBlogPosts(): Promise<Array<Pick<BlogPost, "id" | "content" | "createdAt" | "imageKeys" | "rewardAmount"> & { authorPhone: string }>> {
    const posts = await db.select({
      id: blogPosts.id,
      content: blogPosts.content,
      createdAt: blogPosts.createdAt,
      imageKeys: blogPosts.imageKeys,
      rewardAmount: blogPosts.rewardAmount,
      authorPhone: users.phone,
    })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.userId, users.id))
      .where(and(
        eq(blogPosts.isPublished, true),
        eq(blogPosts.status, "approved"),
      ))
      .orderBy(desc(blogPosts.createdAt))
      .limit(50);

    return posts.map(post => ({ ...post, authorPhone: maskBlogAuthorPhone(post.authorPhone) }));
  }

  async getAdminBlogSubmissions(): Promise<Array<Pick<BlogPost, "id" | "content" | "createdAt" | "imageKeys"> & { authorPhone: string }>> {
    const posts = await db.select({
      id: blogPosts.id,
      content: blogPosts.content,
      createdAt: blogPosts.createdAt,
      imageKeys: blogPosts.imageKeys,
      authorPhone: users.phone,
    })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.userId, users.id))
      .where(and(
        eq(blogPosts.isPublished, true),
        eq(blogPosts.status, "pending"),
      ))
      .orderBy(asc(blogPosts.createdAt))
      .limit(50);

    return posts.map(post => ({ ...post, authorPhone: maskBlogAuthorPhone(post.authorPhone) }));
  }

  async hasSuccessfulWithdrawal(userId: number): Promise<boolean> {
    const [withdrawal] = await db.select({ id: withdrawals.id })
      .from(withdrawals)
      .where(and(
        eq(withdrawals.userId, userId),
        eq(withdrawals.status, BLOG_SUCCESSFUL_WITHDRAWAL_STATUS),
      ))
      .limit(1);
    return Boolean(withdrawal);
  }

  async getBlogPostingEligibility(userId: number, now = new Date()): Promise<BlogPostingEligibility> {
    const [user] = await db.select({ country: users.country })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return { userFound: false, hasSuccessfulWithdrawal: false, submittedToday: false };
    }

    const [withdrawal] = await db.select({ id: withdrawals.id })
      .from(withdrawals)
      .where(and(
        eq(withdrawals.userId, userId),
        eq(withdrawals.status, BLOG_SUCCESSFUL_WITHDRAWAL_STATUS),
      ))
      .limit(1);
    const { start, end } = getBlogLocalDayWindow(now, user.country);
    const activeDraftCutoff = new Date(now.getTime() - BLOG_DRAFT_STALE_MS);
    const [todayPost] = await db.select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(
        eq(blogPosts.userId, userId),
        gte(blogPosts.createdAt, start),
        lt(blogPosts.createdAt, end),
        or(eq(blogPosts.isPublished, true), gte(blogPosts.createdAt, activeDraftCutoff)),
      ))
      .limit(1);

    return {
      userFound: true,
      hasSuccessfulWithdrawal: Boolean(withdrawal),
      submittedToday: Boolean(todayPost),
    };
  }

  async createBlogPostDraft(
    userId: number,
    content: string,
    imageKeys: string[],
    now = new Date(),
  ): Promise<BlogPostDraftAttempt> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(20261105, ${userId})`);

      const staleDrafts = await tx.delete(blogPosts)
        .where(and(
          eq(blogPosts.userId, userId),
          eq(blogPosts.isPublished, false),
          lt(blogPosts.createdAt, new Date(now.getTime() - BLOG_DRAFT_STALE_MS)),
        ))
        .returning({ imageKeys: blogPosts.imageKeys });
      const staleImageKeys = staleDrafts.flatMap((draft) => draft.imageKeys);

      const [user] = await tx.select({ country: users.country })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) return { status: "user_not_found", staleImageKeys };

      const [withdrawal] = await tx.select({ id: withdrawals.id })
        .from(withdrawals)
        .where(and(
          eq(withdrawals.userId, userId),
          eq(withdrawals.status, BLOG_SUCCESSFUL_WITHDRAWAL_STATUS),
        ))
        .limit(1);
      if (!withdrawal) return { status: "withdrawal_required", staleImageKeys };

      const { start, end } = getBlogLocalDayWindow(now, user.country);
      const activeDraftCutoff = new Date(now.getTime() - BLOG_DRAFT_STALE_MS);
      const [todayPost] = await tx.select({ id: blogPosts.id })
        .from(blogPosts)
        .where(and(
          eq(blogPosts.userId, userId),
          gte(blogPosts.createdAt, start),
          lt(blogPosts.createdAt, end),
          or(eq(blogPosts.isPublished, true), gte(blogPosts.createdAt, activeDraftCutoff)),
        ))
        .limit(1);
      if (todayPost) return { status: "daily_limit", staleImageKeys };

      const [post] = await tx.insert(blogPosts)
        .values({ userId, content, imageKeys, isPublished: false, status: "uploading" })
        .returning();
      return { status: "created", post, staleImageKeys };
    });
  }

  async publishBlogPostDraft(userId: number, postId: number): Promise<BlogPost> {
    const [post] = await db.update(blogPosts)
      .set({ isPublished: true, status: "pending" })
      .where(and(
        eq(blogPosts.id, postId),
        eq(blogPosts.userId, userId),
        eq(blogPosts.isPublished, false),
        eq(blogPosts.status, "uploading"),
      ))
      .returning();
    if (!post) throw new Error("La publication en cours est introuvable.");
    return post;
  }

  async deleteBlogPostDraft(userId: number, postId: number): Promise<void> {
    await db.delete(blogPosts)
      .where(and(
        eq(blogPosts.id, postId),
        eq(blogPosts.userId, userId),
        eq(blogPosts.isPublished, false),
      ));
  }

  async getBlogPostImageKey(postId: number, imageIndex: number, forAdmin = false): Promise<string | undefined> {
    const [post] = await db.select({ imageKeys: blogPosts.imageKeys })
      .from(blogPosts)
      .where(and(
        eq(blogPosts.id, postId),
        eq(blogPosts.isPublished, true),
        eq(blogPosts.status, forAdmin ? "pending" : "approved"),
      ))
      .limit(1);
    return post?.imageKeys[imageIndex];
  }

  async approveBlogPost(postId: number, adminId: number, rewardAmount: number): Promise<BlogApprovalResult> {
    if (!Number.isSafeInteger(rewardAmount) || rewardAmount < 1) {
      throw new Error("La récompense doit être un montant entier positif en FCFA.");
    }

    return db.transaction(async (tx) => {
      const [post] = await tx.select({
        id: blogPosts.id,
        userId: blogPosts.userId,
        status: blogPosts.status,
        isPublished: blogPosts.isPublished,
      })
        .from(blogPosts)
        .where(eq(blogPosts.id, postId))
        .for("update")
        .limit(1);

      if (!post) return { status: "not_found" };
      if (!post.isPublished || post.status !== "pending") {
        return { status: "already_reviewed" };
      }

      const updated = await this.adjustBalance(post.userId, "withdrawal", rewardAmount, tx);
      if (!updated) return { status: "user_not_found" };

      const now = new Date();
      const rewardText = rewardAmount.toFixed(2);
      await tx.update(blogPosts)
        .set({
          status: "approved",
          rewardAmount: rewardText,
          reviewedBy: adminId,
          reviewedAt: now,
        })
        .where(eq(blogPosts.id, postId));
      await tx.insert(transactions).values({
        userId: post.userId,
        type: "blog_reward",
        amount: rewardText,
        description: `Récompense de publication Blog #${postId}`,
      });
      await tx.insert(adminAuditLog).values({
        adminId,
        action: "approve_blog_post",
        targetUserId: post.userId,
        details: `Publication Blog #${postId} approuvée — récompense ${rewardText} FCFA`,
      });

      const [user] = await tx.select({ withdrawalBalance: users.withdrawalBalance })
        .from(users)
        .where(eq(users.id, post.userId))
        .limit(1);
      return {
        status: "approved",
        userId: post.userId,
        rewardAmount,
        withdrawalBalance: user?.withdrawalBalance ?? "0",
      };
    });
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    const activeTasks = await db.select().from(tasks).where(eq(tasks.isActive, true)).orderBy(tasks.sortOrder);
    return activeTasks.filter(task => task.name.startsWith(INVITATION_TASK_KEY_PREFIX));
  }

  async getTasksWithStatus(userId: number): Promise<(Task & { isCompleted: boolean; canClaim: boolean; currentInvites: number })[]> {
    const allTasks = await this.getTasks();
    const user = await this.getUser(userId);
    if (!user) return [];

    const level1Refs = await this.getReferrals(userId, 1);
    const referralIds = level1Refs.map(ref => ref.id);
    let currentInvites = 0;

    if (referralIds.length > 0) {
      const approvedDepositRows = await db.selectDistinct({ userId: deposits.userId })
        .from(deposits)
        .where(and(
          inArray(deposits.userId, referralIds),
          eq(deposits.status, "approved"),
        ));
      const purchasedProductRows = await db.selectDistinct({
        userId: userProducts.userId,
        purchaseProductType: userProducts.purchaseProductType,
        productType: products.productType,
        purchasePrice: userProducts.purchasePrice,
        productPrice: products.price,
        isFree: products.isFree,
        assignedByAdmin: userProducts.assignedByAdmin,
      })
        .from(userProducts)
        .innerJoin(products, eq(userProducts.productId, products.id))
        .where(inArray(userProducts.userId, referralIds));

      currentInvites = countQualifiedDirectReferrals(
        level1Refs,
        approvedDepositRows.map(row => row.userId),
        purchasedProductRows,
      );
    }

    const completedTasks = await db.select().from(userTasks).where(eq(userTasks.userId, userId));
    const completedIds = new Set(completedTasks.map(t => t.taskId));

    return allTasks.map(task => ({
      ...task,
      isCompleted: completedIds.has(task.id),
      canClaim: !completedIds.has(task.id) && currentInvites >= task.requiredInvites,
      currentInvites: currentInvites,
    }));
  }

  async claimTask(userId: number, taskId: number): Promise<void> {
    await db.transaction(async tx => {
      const [user] = await tx.select({ withdrawalBalance: users.withdrawalBalance })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!user) throw new Error("Utilisateur non trouvé");

      const tasksStatus = await this.getTasksWithStatus(userId);
      const taskStatus = tasksStatus.find(task => task.id === taskId);

      if (!taskStatus) throw new Error("Tâche non trouvée");
      if (taskStatus.isCompleted) throw new Error("Tâche déjà réclamée");
      if (!taskStatus.canClaim) throw new Error("Conditions non remplies : recharge approuvée et achat d'un produit stable requis");

      await tx.insert(userTasks).values({ userId, taskId });

      await this.adjustBalance(userId, "withdrawal", taskStatus.reward, tx);

      await tx.insert(transactions).values({
        userId,
        type: "task_reward",
        amount: taskStatus.reward.toString(),
        description: `Récompense d'invitation — ${taskStatus.requiredInvites} membres de niveau 1`,
      });
    });
  }

  // Transactions
  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  // Settings
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return setting?.value || null;
  }

  async getSettings(): Promise<Record<string, string>> {
    const allSettings = await db.select().from(platformSettings);
    const result: Record<string, string> = {};
    for (const s of allSettings) {
      if (s.key.startsWith(DRIMPAY_STATUS_CHECK_SETTING_PREFIX)) continue;
      result[s.key] = s.value;
    }
    return result;
  }

  async setSetting(key: string, value: string, modifiedBy?: number): Promise<void> {
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    if (existing.length > 0) {
      await db.update(platformSettings).set({ value, modifiedBy, modifiedAt: new Date() }).where(eq(platformSettings.key, key));
    } else {
      await db.insert(platformSettings).values({ key, value, modifiedBy, modifiedAt: new Date() });
    }
  }

  // Admin
  async getStats(startDate?: Date, endDate?: Date): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Récupérer la date de réinitialisation des stats
    const statsResetDateStr = await this.getSetting("statsResetDate");
    const statsResetDate = statsResetDateStr ? new Date(statsResetDateStr) : new Date(0);
    
    const filterStart = startDate || new Date(0);
    const filterEnd = endDate || new Date();
    filterEnd.setHours(23, 59, 59, 999);

    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, statsResetDate));
    const [todayUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, today));
    const [periodUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users)
      .where(and(gte(users.createdAt, filterStart), lte(users.createdAt, filterEnd)));
    
    const [totalDepositsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits).where(and(eq(deposits.status, "approved"), gte(deposits.createdAt, statsResetDate)));
    const [todayDepositsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits).where(and(eq(deposits.status, "approved"), gte(deposits.createdAt, today)));
    const [periodDepositsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits).where(and(eq(deposits.status, "approved"), gte(deposits.createdAt, filterStart), lte(deposits.createdAt, filterEnd)));
    const [pendingDepositsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)`, count: sql<number>`count(*)` })
      .from(deposits).where(eq(deposits.status, "pending"));
    
    const [totalWithdrawalsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)` })
      .from(withdrawals).where(and(eq(withdrawals.status, "approved"), gte(withdrawals.createdAt, statsResetDate)));
    const [todayWithdrawalsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)` })
      .from(withdrawals).where(and(eq(withdrawals.status, "approved"), gte(withdrawals.createdAt, today)));
    const [periodWithdrawalsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)` })
      .from(withdrawals).where(and(eq(withdrawals.status, "approved"), gte(withdrawals.createdAt, filterStart), lte(withdrawals.createdAt, filterEnd)));
    const [pendingWithdrawalsResult] = await db.select({ total: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)`, count: sql<number>`count(*)` })
      .from(withdrawals).where(eq(withdrawals.status, "pending"));
    
    const [usersWithProductsResult] = await db.select({ count: sql<number>`count(DISTINCT ${userProducts.userId})` })
      .from(userProducts).where(and(eq(userProducts.isActive, true), gte(userProducts.purchaseDate, statsResetDate)));
    
    // Récupérer les valeurs baseline pour les compteurs cumulatifs
    const baselineBalance = parseFloat(await this.getSetting("baselineTotalBalance") || "0");
    const baselineEarnings = parseFloat(await this.getSetting("baselineTotalEarnings") || "0");
    const baselineCommissions = parseFloat(await this.getSetting("baselineTotalCommissions") || "0");
    
    const [totalBalanceResult] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${users.balance} AS DECIMAL)), 0)` })
      .from(users);
    
    const [totalEarningsResult] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${users.totalEarnings} AS DECIMAL)), 0)` })
      .from(users);
    
    const [totalProductsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(userProducts).where(and(eq(userProducts.isActive, true), gte(userProducts.purchaseDate, statsResetDate)));
    
    const [totalCommissionsResult] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
      .from(transactions).where(eq(transactions.type, "commission"));

    // Soustraire les valeurs baseline pour obtenir les stats depuis la réinitialisation
    const adjustedBalance = Math.max(0, parseFloat(totalBalanceResult?.total || "0") - baselineBalance);
    const adjustedEarnings = Math.max(0, parseFloat(totalEarningsResult?.total || "0") - baselineEarnings);
    const adjustedCommissions = Math.max(0, parseFloat(totalCommissionsResult?.total || "0") - baselineCommissions);

    return {
      totalUsers: totalUsersResult?.count || 0,
      todayUsers: todayUsersResult?.count || 0,
      periodUsers: periodUsersResult?.count || 0,
      totalDeposits: parseFloat(totalDepositsResult?.total || "0"),
      todayDeposits: parseFloat(todayDepositsResult?.total || "0"),
      periodDeposits: parseFloat(periodDepositsResult?.total || "0"),
      pendingDeposits: parseFloat(pendingDepositsResult?.total || "0"),
      pendingDepositsCount: pendingDepositsResult?.count || 0,
      totalWithdrawals: parseFloat(totalWithdrawalsResult?.total || "0"),
      todayWithdrawals: parseFloat(todayWithdrawalsResult?.total || "0"),
      periodWithdrawals: parseFloat(periodWithdrawalsResult?.total || "0"),
      pendingWithdrawals: parseFloat(pendingWithdrawalsResult?.total || "0"),
      pendingWithdrawalsCount: pendingWithdrawalsResult?.count || 0,
      usersWithProducts: usersWithProductsResult?.count || 0,
      totalBalance: adjustedBalance,
      totalEarnings: adjustedEarnings,
      totalActiveProducts: totalProductsResult?.count || 0,
      totalCommissions: adjustedCommissions,
    };
  }

  async logAdminAction(adminId: number, action: string, targetUserId: number | null, details: string): Promise<void> {
    await db.insert(adminAuditLog).values({ adminId, action, targetUserId, details });
  }

  async resetStats(): Promise<void> {
    // Stocke la date de réinitialisation - les stats ne comptent que les données après cette date
    await this.setSetting("statsResetDate", new Date().toISOString());
    
    // Stocker les valeurs baseline pour les compteurs cumulatifs (solde et gains)
    const [currentBalance] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${users.balance} AS DECIMAL)), 0)` }).from(users);
    const [currentEarnings] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(${users.totalEarnings} AS DECIMAL)), 0)` }).from(users);
    const [currentCommissions] = await db.select({ total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` }).from(transactions).where(eq(transactions.type, "commission"));
    
    await this.setSetting("baselineTotalBalance", currentBalance?.total || "0");
    await this.setSetting("baselineTotalEarnings", currentEarnings?.total || "0");
    await this.setSetting("baselineTotalCommissions", currentCommissions?.total || "0");
  }

  // Gift Codes
  async getAllGiftCodes(): Promise<GiftCode[]> {
    return await db.select().from(giftCodes).orderBy(desc(giftCodes.createdAt));
  }

  async getGiftCodeByCode(code: string): Promise<GiftCode | undefined> {
    const [giftCode] = await db.select().from(giftCodes).where(
      sql`UPPER(${giftCodes.code}) = UPPER(${code})`
    );
    return giftCode || undefined;
  }

  async createGiftCode(data: { code: string; amount: string; maxUses: number; expiresAt: Date; createdBy: number }): Promise<GiftCode> {
    const [giftCode] = await db.insert(giftCodes).values(data).returning();
    return giftCode;
  }

  async deleteGiftCode(id: number): Promise<void> {
    await db.delete(giftCodes).where(eq(giftCodes.id, id));
  }

  async hasUserClaimedGiftCode(userId: number, giftCodeId: number): Promise<boolean> {
    const [claim] = await db.select().from(giftCodeClaims).where(
      and(eq(giftCodeClaims.userId, userId), eq(giftCodeClaims.giftCodeId, giftCodeId))
    );
    return !!claim;
  }

  async claimGiftCode(userId: number, giftCodeId: number, amount: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.insert(giftCodeClaims).values({ userId, giftCodeId });
      await tx.update(giftCodes).set({
        currentUses: sql`${giftCodes.currentUses} + 1`
      }).where(eq(giftCodes.id, giftCodeId));
      await this.adjustBalance(userId, "deposit", amount, tx);
      await tx.insert(transactions).values({
        userId,
        type: "gift_code",
        amount: amount.toString(),
        description: `Bonus code cadeau`
      });
    });
  }

  // Countries
  async getCountries(): Promise<Country[]> {
    return await db.select().from(countries);
  }

  async getActiveCountries(): Promise<Country[]> {
    return await db.select().from(countries).where(eq(countries.isActive, true));
  }

  async getCountry(id: number): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  async createCountry(data: Partial<Country>): Promise<Country> {
    const [country] = await db.insert(countries).values(data as any).returning();
    return country;
  }

  async updateCountry(id: number, data: Partial<Country>): Promise<Country> {
    const [country] = await db.update(countries).set(data as any).where(eq(countries.id, id)).returning();
    return country;
  }

  async deleteCountry(id: number): Promise<void> {
    await db.delete(countries).where(eq(countries.id, id));
  }

  // Payment Numbers
  async getPaymentNumbers(): Promise<PaymentNumber[]> {
    return await db.select().from(paymentNumbers).orderBy(desc(paymentNumbers.createdAt));
  }

  async getAdminPaymentNumberStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [depositRows, bankerRows] = await Promise.all([
      db.select({
        paymentNumberId: deposits.paymentNumberId,
        totalAmount: sql<string>`COALESCE(SUM(${deposits.amount}), 0)`,
        todayAmount: sql<string>`COALESCE(SUM(CASE WHEN ${deposits.processedAt} >= ${today} AND ${deposits.processedAt} < ${tomorrow} THEN ${deposits.amount} ELSE 0 END), 0)`,
      })
        .from(deposits)
        .where(eq(deposits.status, "approved"))
        .groupBy(deposits.paymentNumberId),
      db.select({
        bankerId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        country: users.country,
        totalWithdrawals: sql<string>`COALESCE(SUM(${withdrawals.amount}), 0)`,
        todayWithdrawals: sql<string>`COALESCE(SUM(CASE WHEN ${withdrawals.processedAt} >= ${today} AND ${withdrawals.processedAt} < ${tomorrow} THEN ${withdrawals.amount} ELSE 0 END), 0)`,
      })
        .from(users)
        .leftJoin(withdrawals, and(
          eq(withdrawals.processedBy, users.id),
          eq(withdrawals.status, "approved"),
        ))
        .where(eq(users.isBanker, true))
        .groupBy(users.id, users.fullName, users.phone, users.country)
        .orderBy(asc(users.country), asc(users.fullName)),
    ]);

    return {
      paymentNumbers: depositRows
        .filter((row): row is typeof row & { paymentNumberId: number } => row.paymentNumberId !== null)
        .map(row => ({
          paymentNumberId: row.paymentNumberId,
          totalAmount: Number(row.totalAmount),
          todayAmount: Number(row.todayAmount),
        })),
      bankers: bankerRows.map(row => ({
        bankerId: row.bankerId,
        fullName: row.fullName,
        phone: row.phone,
        country: row.country,
        totalWithdrawals: Number(row.totalWithdrawals),
        todayWithdrawals: Number(row.todayWithdrawals),
      })),
    };
  }

  async getPaymentNumber(id: number): Promise<PaymentNumber | undefined> {
    const [num] = await db.select().from(paymentNumbers).where(eq(paymentNumbers.id, id));
    return num || undefined;
  }

  async getPaymentNumbersByCountry(country: string): Promise<PaymentNumber[]> {
    return await db.select().from(paymentNumbers)
      .where(and(eq(paymentNumbers.country, country), eq(paymentNumbers.isActive, true)))
      .orderBy(paymentNumbers.operatorName);
  }

  async createPaymentNumber(data: Partial<PaymentNumber>): Promise<PaymentNumber> {
    const [num] = await db.insert(paymentNumbers).values(data as any).returning();
    return num;
  }

  async updatePaymentNumber(id: number, data: Partial<PaymentNumber>): Promise<PaymentNumber> {
    const [num] = await db.update(paymentNumbers).set(data as any).where(eq(paymentNumbers.id, id)).returning();
    return num;
  }

  async deletePaymentNumber(id: number): Promise<void> {
    await db.delete(paymentNumbers).where(eq(paymentNumbers.id, id));
  }

  // Staking Products
  async getStakingProducts(): Promise<StakingProduct[]> {
    return await db.select().from(stakingProducts).orderBy(stakingProducts.createdAt);
  }

  async getActiveStakingProducts(): Promise<StakingProduct[]> {
    return await db.select().from(stakingProducts)
      .where(eq(stakingProducts.isActive, true))
      .orderBy(stakingProducts.launchDate);
  }

  async getStakingProduct(id: number): Promise<StakingProduct | undefined> {
    const [sp] = await db.select().from(stakingProducts).where(eq(stakingProducts.id, id));
    return sp || undefined;
  }

  async createStakingProduct(data: Partial<StakingProduct>): Promise<StakingProduct> {
    const [sp] = await db.insert(stakingProducts).values(data as any).returning();
    return sp;
  }

  async updateStakingProduct(id: number, data: Partial<StakingProduct>): Promise<StakingProduct> {
    const [sp] = await db.update(stakingProducts).set(data as any).where(eq(stakingProducts.id, id)).returning();
    return sp;
  }

  async deleteStakingProduct(id: number): Promise<void> {
    await db.delete(stakingProducts).where(eq(stakingProducts.id, id));
  }

  async purchaseStaking(userId: number, stakingProductId: number): Promise<UserStaking> {
    const sp = await this.getStakingProduct(stakingProductId);
    if (!sp) throw new Error("Produit de staking introuvable");
    if (!sp.isActive) throw new Error("Produit de staking inactif");

    const now = new Date();
    if (sp.launchDate && new Date(sp.launchDate) > now) {
      throw new Error("Ce produit n'est pas encore disponible à l'achat");
    }

    const releaseDate = new Date(now.getTime() + sp.lockDays * 24 * 60 * 60 * 1000);
    return db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
      if (!user) throw new Error("Utilisateur introuvable");
      const currentDeposit = parseFloat(user.depositBalance);
      if (currentDeposit < sp.price) {
        throw new Error(`Solde de dépôt insuffisant. Il vous manque ${(sp.price - currentDeposit).toLocaleString()} ${user.country === "TD" ? "XAF" : "XOF"}`);
      }

      const activeProds = await tx.select().from(userProducts)
        .where(and(eq(userProducts.userId, userId), eq(userProducts.isActive, true)));
      if (activeProds.length === 0) {
        throw new Error("Vous devez posséder un produit actif avant d'accéder au Staking");
      }

      if (!await this.adjustBalance(userId, "deposit", -sp.price, tx)) {
        throw new Error("Solde de dépôt insuffisant");
      }

      const [staking] = await tx.insert(userStakings).values({
        userId,
        stakingProductId,
        amountPaid: sp.price,
        returnAmount: sp.returnAmount,
        purchasedAt: now,
        releaseDate,
        status: "active",
      }).returning();

      await tx.insert(transactions).values({
        userId,
        type: "staking",
        amount: (-sp.price).toString(),
        description: `Staking: ${sp.name}`,
      });
      return staking;
    });
  }

  async getUserStakings(userId: number): Promise<(UserStaking & { product: StakingProduct })[]> {
    const result = await db.select({ staking: userStakings, product: stakingProducts })
      .from(userStakings)
      .innerJoin(stakingProducts, eq(userStakings.stakingProductId, stakingProducts.id))
      .where(eq(userStakings.userId, userId))
      .orderBy(desc(userStakings.purchasedAt));
    return result.map(r => ({ ...r.staking, product: r.product }));
  }

  async getAllUserStakings(): Promise<(UserStaking & { product: StakingProduct; user: User })[]> {
    const result = await db.select({ staking: userStakings, product: stakingProducts, user: users })
      .from(userStakings)
      .innerJoin(stakingProducts, eq(userStakings.stakingProductId, stakingProducts.id))
      .innerJoin(users, eq(userStakings.userId, users.id))
      .orderBy(desc(userStakings.purchasedAt));
    return result.map(r => ({ ...r.staking, product: r.product, user: r.user }));
  }

  async releaseMaturedStakings(): Promise<void> {
    const now = new Date();
    const matured = await db.select().from(userStakings)
      .where(and(eq(userStakings.status, "active"), lte(userStakings.releaseDate, now)));

    for (const staking of matured) {
      try {
        await db.transaction(async (tx) => {
          const [released] = await tx.update(userStakings)
          .set({ status: "released", releasedAt: now })
          .where(and(
            eq(userStakings.id, staking.id),
            eq(userStakings.status, "active"),
            lte(userStakings.releaseDate, now),
          ))
          .returning({ id: userStakings.id });
          if (!released) return;

          if (!await this.adjustBalance(staking.userId, "withdrawal", staking.returnAmount, tx)) {
            throw new Error("Utilisateur introuvable lors du versement du staking");
          }

          await tx.insert(transactions).values({
            userId: staking.userId,
            type: "staking_release",
            amount: staking.returnAmount.toString(),
            description: `Déblocage staking #${staking.id}`,
          });
        });
      } catch (e) {
        console.error("Error releasing staking:", staking.id, e);
      }
    }
  }
}

export const storage = new DatabaseStorage();
