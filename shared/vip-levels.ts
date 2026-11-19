export const VIP_INR_TO_FCFA_RATE = 6.1859;
export const VIP_INR_TO_FCFA_RATE_DATE = "2026-11-06";

export const VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES = [
  "commission",
  "deposit_commission",
  "task_reward",
  "daily_checkin",
  "wheel_prize_withdrawal",
] as const;

export function isVipQualifyingCreditTransactionType(type: string): boolean {
  return (VIP_QUALIFYING_CREDIT_TRANSACTION_TYPES as readonly string[]).includes(type);
}

export const VIP_LEVEL_THRESHOLDS_INR = [
  0,
  270,
  770,
  1_770,
  17_700,
  37_700,
  57_700,
  77_700,
  97_700,
] as const;

export const VIP_LEVEL_THRESHOLDS_FCFA = VIP_LEVEL_THRESHOLDS_INR.map(
  (amount) => Math.round(amount * VIP_INR_TO_FCFA_RATE),
);

export interface VipLevelProgress {
  level: number;
  thresholdFcfa: number;
  progressFcfa: number;
  progressPercent: number;
  isCurrent: boolean;
}

export interface VipLevelsSummary {
  totalQualifyingCredits: number;
  currentLevel: number;
  levels: VipLevelProgress[];
}

export function calculateVipLevels(qualifyingCreditTotal: number): VipLevelsSummary {
  const totalQualifyingCredits = Number.isFinite(qualifyingCreditTotal)
    ? Math.max(0, qualifyingCreditTotal)
    : 0;
  let currentLevel = 0;

  for (let level = 1; level < VIP_LEVEL_THRESHOLDS_FCFA.length; level += 1) {
    if (totalQualifyingCredits >= VIP_LEVEL_THRESHOLDS_FCFA[level]) {
      currentLevel = level;
    }
  }

  return {
    totalQualifyingCredits,
    currentLevel,
    levels: VIP_LEVEL_THRESHOLDS_FCFA.map((thresholdFcfa, level) => ({
      level,
      thresholdFcfa,
      progressFcfa: totalQualifyingCredits,
      progressPercent: thresholdFcfa === 0
        ? 100
        : Math.min(100, (totalQualifyingCredits / thresholdFcfa) * 100),
      isCurrent: level === currentLevel,
    })),
  };
}
