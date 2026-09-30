import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import SubscriptionEvent from '../models/SubscriptionEvent.js';
import FamilyLink from '../models/FamilyLink.js';
import AppConfig from '../models/AppConfig.js';
import Transaction from '../models/Transaction.js';
import { FREE_PLAN, GRACE_DAYS, PLANS, STATUS, isEntitled, statusAt } from './subscription.js';

/* The one place that decides what a user may use. Controllers ask
   canAccess(ent, FEATURES.X) or limitOf(ent, 'documents') — never
   "is this user on PLUS" — so moving a feature between plans is a
   config change, not a code hunt.

   Everything basic (history, medicines, reminders, readings, the basic
   summary, family basics) is not a feature here at all: it's always
   on, for everyone, whatever happens to their subscription. */

export const FEATURES = {
  ADVANCED_TRENDS: 'ADVANCED_TRENDS', // trend charts beyond limits.trendDays
  ADVANCED_HEALTH_SUMMARY: 'ADVANCED_HEALTH_SUMMARY',
  ADVANCED_REPORTS: 'ADVANCED_REPORTS',
  EXTENDED_STORAGE: 'EXTENDED_STORAGE', // report attachments beyond limits.documents
  ADVANCED_MEDICATIONS: 'ADVANCED_MEDICATIONS', // refill reminders, quantity tracking extras
  UNLIMITED_INSIGHTS: 'UNLIMITED_INSIGHTS',
  FAMILY_SHARING: 'FAMILY_SHARING', // a family of up to limits.familyMembers
};

const PAID = [
  FEATURES.ADVANCED_TRENDS,
  FEATURES.ADVANCED_HEALTH_SUMMARY,
  FEATURES.ADVANCED_REPORTS,
  FEATURES.EXTENDED_STORAGE,
  FEATURES.ADVANCED_MEDICATIONS,
  FEATURES.UNLIMITED_INSIGHTS,
];

/* Defaults. Any tier's features/limits can be overridden without a
   release by a document in the appconfigs collection:
     { key: 'entitlements', value: { free: { limits: { documents: 15 } } } }
   A limit of null means unlimited. */
const DEFAULT_TIERS = {
  free: { features: [], limits: { documents: 10, familyMembers: 2, trendDays: 30, insightsPerMonth: 3 } },
  plus: { features: PAID, limits: { documents: null, familyMembers: 2, trendDays: null, insightsPerMonth: null } },
  family: { features: [...PAID, FEATURES.FAMILY_SHARING], limits: { documents: null, familyMembers: 6, trendDays: null, insightsPerMonth: null } },
};

const CONFIG_TTL_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

async function tiers() {
  if (cached && Date.now() - cachedAt < CONFIG_TTL_MS) return cached;
  let override = {};
  try {
    override = (await AppConfig.findOne({ key: 'entitlements' }).lean())?.value || {};
  } catch (err) {
    console.warn('Entitlement config unavailable, using defaults —', err.message);
  }
  const merged = {};
  for (const [tier, def] of Object.entries(DEFAULT_TIERS)) {
    const o = override[tier] || {};
    merged[tier] = {
      features: Array.isArray(o.features) ? o.features.filter(f => FEATURES[f]) : def.features,
      limits: { ...def.limits, ...(o.limits || {}) },
    };
  }
  cached = merged;
  cachedAt = Date.now();
  return merged;
}

/* Accounts that bought the old ₹199/₹1,999 "premium" before plans
   existed keep what they paid for: their remaining time becomes Plus. */
async function migrateLegacy(userId) {
  const user = await User.findById(userId, 'subscription premiumExpiry').lean();
  const end = user?.premiumExpiry ? new Date(user.premiumExpiry) : null;
  if (!user || user.subscription !== 'premium' || !end || end.getTime() <= Date.now()) return null;
  const last = await Transaction.findOne({ userId, status: 'success' }).sort({ createdAt: -1 }).lean();
  const plan = last?.plan === 'premium_annual' ? 'PLUS_ANNUAL' : 'PLUS_MONTHLY';
  return Subscription.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        plan,
        status: STATUS.ACTIVE,
        billingPeriod: PLANS[plan].billingPeriod,
        provider: 'legacy',
        purchaseDate: last?.createdAt || null,
        startDate: last?.createdAt || null,
        expiryDate: end,
      },
    },
    { upsert: true, new: true, lean: true },
  );
}

/* Brings the stored status in line with the dates. The first time a
   paid plan is seen past its end, that's recorded once as
   subscription_expired — the conditional update makes sure two
   concurrent requests can't both record it. */
async function syncStatus(sub, status) {
  if (!sub?._id || sub.status === status) return;
  const res = await Subscription.updateOne({ _id: sub._id, status: sub.status }, { $set: { status } });
  if (res.modifiedCount && status === STATUS.EXPIRED) {
    await SubscriptionEvent.create({ userId: sub.userId, event: 'subscription_expired', plan: sub.plan }).catch(() => {});
  }
}

// a Family plan an accepted family link gives this user a share of, if any
async function inheritedFamilyPlan(userId) {
  const links = await FamilyLink.find({ memberId: userId, status: 'accepted' }, 'ownerId').lean();
  if (!links.length) return null;
  const graceCutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const subs = await Subscription.find({
    userId: { $in: links.map(l => l.ownerId) },
    plan: { $in: ['FAMILY_MONTHLY', 'FAMILY_ANNUAL'] },
    expiryDate: { $gt: graceCutoff },
  }).lean();
  return subs.find(s => isEntitled(statusAt(s))) || null;
}

export function publicSubscription(sub, status) {
  const plan = sub?.plan || FREE_PLAN;
  const info = PLANS[plan];
  return {
    plan,
    status,
    tier: info?.tier || 'free',
    label: info?.label || 'Free',
    amount: info?.amount || 0,
    billingPeriod: info?.billingPeriod || null,
    provider: sub?.provider || null,
    purchaseDate: sub?.purchaseDate || null,
    startDate: sub?.startDate || null,
    expiryDate: sub?.expiryDate || null,
    renewalDate: sub?.expiryDate || null,
    autoRenew: false,
    cancelledAt: sub?.cancelledAt || null,
    graceDays: GRACE_DAYS,
  };
}

/* Everything a request needs to know about what this user may do:
     tier     — 'free' | 'plus' | 'family', the tier actually in force
     source   — 'own' (their plan), 'family' (a share of someone's
                Family plan) or 'free'
     features — FEATURES keys that are on
     limits   — { documents, familyMembers, trendDays, insightsPerMonth }
     subscription — their own plan, as shown on the Subscription screen */
export async function resolveEntitlement(userId) {
  let sub = await Subscription.findOne({ userId }).lean();
  if (!sub) sub = await migrateLegacy(userId);

  const status = statusAt(sub);
  await syncStatus(sub, status);

  let tier = 'free';
  let source = 'free';
  if (isEntitled(status) && PLANS[sub.plan]) {
    tier = PLANS[sub.plan].tier;
    source = 'own';
  }
  // a Family member gets the personal (Plus) features, but not a family of their own to manage
  if (tier === 'free' && (await inheritedFamilyPlan(userId))) {
    tier = 'plus';
    source = 'family';
  }

  const t = (await tiers())[tier];
  return { tier, source, features: t.features, limits: t.limits, subscription: publicSubscription(sub, status) };
}

export const canAccess = (ent, feature) => !!ent?.features?.includes(feature);

// null → unlimited
export const limitOf = (ent, name) => (ent?.limits?.[name] === undefined ? null : ent.limits[name]);
