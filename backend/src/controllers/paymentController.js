import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { PLANS, isPremium } from '../utils/subscription.js';
import { buildPayuConfig, buildRequestHash, buildReverseHash } from '../utils/payu.js';
import { isOneOf } from '../utils/validators.js';

function resultHtml(outcome) {
  const message = outcome === 'SUCCESS' ? 'Payment successful' : 'Payment unsuccessful';
  return `<!DOCTYPE html>
<html>
  <body>
    <script>
      setTimeout(function () {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('${outcome}');
      }, 400);
    </script>
    <p style="font-family: sans-serif; text-align: center; margin-top: 80px;">${message}. Return to the MyHealthBook app…</p>
  </body>
</html>`;
}

export async function initiateCheckout(req, res) {
  const { plan } = req.body || {};

  if (!isOneOf(plan, Object.keys(PLANS))) {
    return res.status(400).json({ success: false, message: 'Invalid plan' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (!user.phone) {
    return res.status(400).json({ success: false, message: 'Please add your phone number in your profile before subscribing to Premium.' });
  }

  let payuConfig;
  try {
    payuConfig = buildPayuConfig();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }

  const planInfo = PLANS[plan];
  const txnid = `mhb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const amount = planInfo.amount.toFixed(2);
  const productinfo = plan;
  const firstname = user.name;
  const email = user.email;
  const phone = user.phone;
  const udf1 = 'subscription';
  const udf2 = plan;
  const udf3 = user._id.toString();
  const udf4 = '';
  const udf5 = '';

  const hash = buildRequestHash({ key: payuConfig.key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, salt: payuConfig.salt });

  const base = process.env.WEB_BASE_URL || 'https://myhealthbook.rehabiphy.com';
  const surl = `${base}/api/payments/payu-success`;
  const furl = `${base}/api/payments/payu-failure`;

  return res.json({
    success: true,
    key: payuConfig.key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    surl,
    furl,
    hash,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    payuUrl: payuConfig.payuUrl,
  });
}

/* Public — no requireAuth. PayU posts application/x-www-form-urlencoded
   directly to this endpoint (surl/furl), so there's no bearer token to
   check; the reverse-hash verification below is the only trust boundary.
   Bound to both /payu-success and /payu-failure since PayU can post a
   failure outcome to either URL — branch on the posted `status` field
   itself rather than which URL was hit. */
export async function handlePayuCallback(req, res) {
  let payuConfig;
  try {
    payuConfig = buildPayuConfig();
  } catch (err) {
    console.error('PayU callback received but PayU is not configured:', err.message);
    return res.status(500).type('html').send(resultHtml('FAILURE'));
  }

  const { status, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, hash: receivedHash } = req.body || {};

  if (!txnid || !status || !receivedHash) {
    return res.status(400).type('html').send(resultHtml('FAILURE'));
  }

  const expectedHash = buildReverseHash({ salt: payuConfig.salt, key: payuConfig.key, status, udf1, udf2, udf3, udf4, udf5, email, firstname, productinfo, amount, txnid });

  if (expectedHash !== receivedHash) {
    console.error('PayU hash mismatch — rejecting callback', { txnid });
    return res.status(400).type('html').send(resultHtml('FAILURE'));
  }

  if (status !== 'success') {
    return res.type('html').send(resultHtml('FAILURE'));
  }

  const existing = await Transaction.findOne({ txnid });
  if (existing) {
    // Replayed success POST — already processed, no-op so premium isn't re-granted/extended twice.
    return res.type('html').send(resultHtml('SUCCESS'));
  }

  const plan = udf2;
  const planInfo = PLANS[plan];
  const user = planInfo ? await User.findById(udf3) : null;
  if (!user) {
    return res.status(400).type('html').send(resultHtml('FAILURE'));
  }

  try {
    await Transaction.create({ userId: user._id, txnid, plan, amount: Number(amount), status: 'success' });
  } catch (err) {
    if (err.code === 11000) {
      // Lost a race to a concurrent replay of the same txnid — already recorded.
      return res.type('html').send(resultHtml('SUCCESS'));
    }
    throw err;
  }

  const now = Date.now();
  const activeBase = isPremium(user) ? new Date(user.premiumExpiry).getTime() : now;
  user.subscription = 'premium';
  user.premiumExpiry = new Date(activeBase + planInfo.days * 24 * 60 * 60 * 1000);
  await user.save();

  return res.type('html').send(resultHtml('SUCCESS'));
}
