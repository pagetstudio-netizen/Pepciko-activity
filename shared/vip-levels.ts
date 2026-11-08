export const VIP_INR_TO_FCFA_RATE = 6.1859;
export const VIP_INR_TO_FCFA_RATE_DATE = "2026-11-06";

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
  totalDeposits: number;
  currentLevel: number;
  levels: VipLevelProgress[];
}

export function calculateVipLevels(totalApprovedDeposits: number): VipLevelsSummary {
  const totalDeposits = Number.isFinite(totalApprovedDeposits)
    ? Math.max(0, totalApprovedDeposits)
    : 0;
  let currentLevel = 0;

  for (let level = 1; level < VIP_LEVEL_THRESHOLDS_FCFA.length; level += 1) {
    if (totalDeposits >= VIP_LEVEL_THRESHOLDS_FCFA[level]) {
      currentLevel = level;
    }
  }

  return {
    totalDeposits,
    currentLevel,
    levels: VIP_LEVEL_THRESHOLDS_FCFA.map((thresholdFcfa, level) => ({
      level,
      thresholdFcfa,
      progressFcfa: totalDeposits,
      progressPercent: thresholdFcfa === 0
        ? 100
        : Math.min(100, (totalDeposits / thresholdFcfa) * 100),
      isCurrent: level === currentLevel,
    })),
  };
}
