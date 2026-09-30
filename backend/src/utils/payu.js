import crypto from 'crypto';

/* Throws rather than returning null so callers can catch it into the
   same {success:false, message} shape used elsewhere for missing
   config (e.g. coachController's missing-OPENAI_API_KEY handling) —
   never ship a hardcoded fallback key/salt, unlike the sibling
   Fithabit project's PayU integration does. */
export function buildPayuConfig() {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  if (!key || !salt) {
    throw new Error("Payments aren't configured yet — ask the app owner to add PayU credentials.");
  }
  const live = (process.env.PAYU_MODE || 'test') === 'live';
  const payuUrl = live ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  const verifyUrl = live ? 'https://info.payu.in/merchant/postservice?form=2' : 'https://test.payu.in/merchant/postservice?form=2';
  return { key, salt, payuUrl, verifyUrl };
}

/* Asks PayU directly how a transaction ended (the verify_payment API) —
   for payments whose callback never reached us, e.g. the app was closed
   mid-payment. Returns PayU's record for the txnid ({ status, amt,
   mihpayid, … }) or null if PayU doesn't know it. */
export async function verifyPayment(txnid) {
  const { key, salt, verifyUrl } = buildPayuConfig();
  const command = 'verify_payment';
  const hash = crypto.createHash('sha512').update(`${key}|${command}|${txnid}|${salt}`).digest('hex');
  const res = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key, command, var1: txnid, hash }).toString(),
  });
  if (!res.ok) throw new Error(`PayU verify_payment returned ${res.status}`);
  const json = await res.json();
  return json?.transaction_details?.[txnid] || null;
}

export function buildRequestHash({ key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4 = '', udf5 = '', salt }) {
  const str = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

export function buildReverseHash({ salt, status, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', email, firstname, productinfo, amount, txnid, key }) {
  const str = `${salt}|${status}|||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}
