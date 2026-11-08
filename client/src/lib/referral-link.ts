export function buildReferralLink(origin: string, referralCode: string): string {
  const normalizedCode = referralCode.trim().toLowerCase();
  return `${origin.replace(/\/+$/, "")}/tg/pages/login/reset?inviteCode=${encodeURIComponent(normalizedCode)}`;
}
