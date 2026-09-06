export const PLANS = {
  premium_monthly: { amount: 199, days: 30, label: 'Premium — Monthly' },
  premium_annual: { amount: 1999, days: 365, label: 'Premium — Annual' },
};

export function isPremium(user) {
  if (!user || user.subscription !== 'premium' || !user.premiumExpiry) return false;
  return new Date(user.premiumExpiry).getTime() > Date.now();
}
