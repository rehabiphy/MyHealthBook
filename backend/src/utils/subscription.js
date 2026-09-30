/* The paid plans. Each is a prepaid pass bought through PayU: it runs
   for `days` and then ends, with no auto-renew. Monthly and annual
   versions of a tier unlock exactly the same features — only the
   billing period differs. What each tier unlocks lives in
   utils/entitlements.js, never here. */
export const PLANS = {
  PLUS_MONTHLY: { tier: 'plus', billingPeriod: 'monthly', amount: 49, days: 30, label: 'MyHealthBook Plus' },
  PLUS_ANNUAL: { tier: 'plus', billingPeriod: 'annual', amount: 399, days: 365, label: 'Plus Annual' },
  FAMILY_MONTHLY: { tier: 'family', billingPeriod: 'monthly', amount: 79, days: 30, label: 'Family' },
  FAMILY_ANNUAL: { tier: 'family', billingPeriod: 'annual', amount: 699, days: 365, label: 'Family Annual' },
};

export const FREE_PLAN = 'FREE';
export const PAID_PLANS = Object.keys(PLANS);

// after a pass ends, Plus/Family features stay on this long so a late renewal loses nothing
export const GRACE_DAYS = 3;

export const STATUS = {
  FREE: 'FREE',
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED', // won't be renewed, but runs to its end date
  GRACE_PERIOD: 'GRACE_PERIOD',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EXPIRED: 'EXPIRED',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/* The status a subscription is in right now, from its dates alone — so
   nothing depends on a background job having run on time. */
export function statusAt(sub, now = Date.now()) {
  if (!sub || !sub.plan || sub.plan === FREE_PLAN || !sub.expiryDate) return STATUS.FREE;
  const end = new Date(sub.expiryDate).getTime();
  if (now < end) return sub.cancelledAt ? STATUS.CANCELLED : STATUS.ACTIVE;
  if (now < end + GRACE_DAYS * DAY_MS && !sub.cancelledAt) return STATUS.GRACE_PERIOD;
  return STATUS.EXPIRED;
}

// whether the paid tier's features are on right now
export const isEntitled = status => status === STATUS.ACTIVE || status === STATUS.CANCELLED || status === STATUS.GRACE_PERIOD;

/* The new end date when `plan` is bought on top of `sub`. Whatever is
   left on the current pass isn't lost: its remaining value, at the
   price paid for it, is turned into extra days of the new plan. Buying
   the same plan again therefore just extends it; moving from Plus
   Annual to Family Monthly converts the unused Plus time into Family
   time at Family's daily rate, so switching plans can't be used to
   get the pricier tier for the cheaper tier's money. */
export function expiryAfterPurchase(sub, plan, now = Date.now()) {
  const next = PLANS[plan];
  let creditDays = 0;
  const current = sub && PLANS[sub.plan];
  const end = sub?.expiryDate ? new Date(sub.expiryDate).getTime() : 0;
  if (current && end > now) {
    const remainingDays = (end - now) / DAY_MS;
    const remainingValue = remainingDays * (current.amount / current.days);
    creditDays = remainingValue / (next.amount / next.days);
  }
  return new Date(now + (next.days + creditDays) * DAY_MS);
}
