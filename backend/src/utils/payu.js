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
  const payuUrl = (process.env.PAYU_MODE || 'test') === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  return { key, salt, payuUrl };
}

export function buildRequestHash({ key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4 = '', udf5 = '', salt }) {
  const str = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

export function buildReverseHash({ salt, status, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', email, firstname, productinfo, amount, txnid, key }) {
  const str = `${salt}|${status}|||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}
