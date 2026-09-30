import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import PasswordResetOtp from '../models/PasswordResetOtp.js';
import { sendOtpEmail, sendVerificationLinkEmail } from '../utils/mailer.js';
import { isValidEmail, isNonEmptyString, isValidPhone, isValidPassword, isValidUsername, normalizeUsername, USERNAME_RULES } from '../utils/validators.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateVerifyToken() {
  return crypto.randomBytes(24).toString('hex');
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username || null,
    email: user.email,
    phone: user.phone,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    insightsUsedThisMonth: user.insightsMonthKey === monthKey() ? user.insightsUsedThisMonth : 0,
  };
}

function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export async function sendVerification(req, res) {
  const { name, email } = req.body || {};

  if (!isNonEmptyString(name, { max: 100 })) {
    return res.status(400).json({ success: false, message: 'Please enter your full name' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  const token = generateVerifyToken();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await EmailVerification.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, otp: token, attempts: 0, verified: false, expiresAt },
    { upsert: true, setDefaultsOnInsert: true },
  );

  const base = process.env.WEB_BASE_URL || 'https://myhealthbook.rehabiphy.com';
  const verifyUrl = `${base}/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

  await sendVerificationLinkEmail({ to: normalizedEmail, name: name.trim(), verifyUrl });

  return res.json({ success: true, message: 'Verification email sent' });
}

/* Shared by the POST /api/auth/verify-email route (called by the app
   itself when the https App Link opens it directly) AND the GET
   /verify web-fallback page in app.js (hit when the app isn't
   installed, or App Links verification hasn't gone through yet, so
   the link just opens in a normal browser instead). */
export async function performEmailVerification(email, token) {
  const normalizedEmail = normalizeEmail(email);

  const record = await EmailVerification.findOne({ email: normalizedEmail });
  if (!record) {
    return { ok: false, message: 'No verification request found for this email' };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await EmailVerification.deleteOne({ _id: record._id });
    return { ok: false, message: 'This link has expired. Please request a new one from the app.' };
  }
  if (record.verified) {
    return { ok: true, alreadyVerified: true };
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, message: 'Too many attempts. Please request a new link.' };
  }
  if (record.otp !== String(token || '').trim()) {
    record.attempts += 1;
    await record.save();
    return { ok: false, message: 'Invalid verification link' };
  }

  record.verified = true;
  await record.save();
  return { ok: true };
}

export async function verifyEmail(req, res) {
  const { email, token, otp } = req.body || {};
  const result = await performEmailVerification(email, token ?? otp);
  if (!result.ok) {
    return res.status(400).json({ success: false, message: result.message });
  }
  return res.json({ success: true, verified: true });
}

export async function checkVerificationStatus(req, res) {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  const record = await EmailVerification.findOne({ email: normalizedEmail });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return res.json({ success: true, verified: false, expired: !!record });
  }

  return res.json({ success: true, verified: record.verified });
}

const isDuplicateUsername = err => err?.code === 11000 && (err.keyPattern?.username || /username/.test(err.message));

/* GET /api/auth/username-available?username=parth.p — public, so the
   registration form can check as the user types. */
export async function checkUsername(req, res) {
  const username = normalizeUsername(req.query.username);
  if (!isValidUsername(username)) {
    return res.json({ success: true, username, available: false, message: USERNAME_RULES });
  }
  const taken = await User.exists({ username });
  return res.json({ success: true, username, available: !taken, message: taken ? 'That username is taken' : '' });
}

/* PATCH /api/auth/username — for accounts created before usernames
   existed (and Google sign-ups), which pick one on their next login. */
export async function setUsername(req, res) {
  const username = normalizeUsername(req.body?.username);
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, message: USERNAME_RULES });
  }
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { username }, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    if (isDuplicateUsername(err)) {
      return res.status(409).json({ success: false, message: 'That username is taken' });
    }
    throw err;
  }
}

export async function register(req, res) {
  const { name, email, phone, password } = req.body || {};
  const username = normalizeUsername(req.body?.username);

  if (!isNonEmptyString(name, { max: 100 })) {
    return res.status(400).json({ success: false, message: 'Please enter your full name' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, message: USERNAME_RULES });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid phone number' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
  }

  const normalizedEmail = normalizeEmail(email);

  const verification = await EmailVerification.findOne({ email: normalizedEmail });
  if (!verification || !verification.verified || verification.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: 'Please verify your email first' });
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  if (await User.exists({ username })) {
    return res.status(409).json({ success: false, message: 'That username is taken' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      username,
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      isEmailVerified: true,
    });
  } catch (err) {
    // two sign-ups racing for the same name — the unique index is the real check
    if (isDuplicateUsername(err)) {
      return res.status(409).json({ success: false, message: 'That username is taken' });
    }
    throw err;
  }

  await EmailVerification.deleteOne({ _id: verification._id });

  const token = signToken(user);
  return res.status(201).json({ success: true, token, user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || !isNonEmptyString(password, { max: 128 })) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return res.status(400).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(user);
  return res.json({ success: true, token, user: publicUser(user) });
}

export async function getMe(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  return res.json({ success: true, user: publicUser(user) });
}

export async function forgotPasswordSendOtp(req, res) {
  const { email } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(400).json({ success: false, message: 'No account with this email' });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await PasswordResetOtp.findOneAndUpdate(
    { email: normalizedEmail },
    { email: normalizedEmail, otp, attempts: 0, verified: false, expiresAt },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await sendOtpEmail({ to: normalizedEmail, name: user.name, otp });

  return res.json({ success: true, message: 'Reset code sent' });
}

export async function forgotPasswordVerifyOtp(req, res) {
  const { email, otp } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  const record = await PasswordResetOtp.findOne({ email: normalizedEmail });
  if (!record) {
    return res.status(400).json({ success: false, message: 'No reset code was sent to this email' });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await PasswordResetOtp.deleteOne({ _id: record._id });
    return res.status(400).json({ success: false, message: 'This code has expired. Please request a new one.' });
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new code.' });
  }
  if (record.otp !== String(otp || '').trim()) {
    record.attempts += 1;
    await record.save();
    return res.status(400).json({ success: false, message: 'Incorrect code' });
  }

  record.verified = true;
  await record.save();

  return res.json({ success: true, verified: true });
}

export async function forgotPasswordReset(req, res) {
  const { email, password } = req.body || {};

  if (!isValidPassword(password)) {
    return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
  }

  const normalizedEmail = normalizeEmail(email);
  const record = await PasswordResetOtp.findOne({ email: normalizedEmail });
  if (!record || !record.verified || record.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: 'Please verify your reset code first' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await PasswordResetOtp.deleteOne({ _id: record._id });

  return res.json({ success: true, message: 'Password reset' });
}

export async function registerFcmToken(req, res) {
  const { token, tzOffsetMin } = req.body || {};
  if (!isNonEmptyString(token, { max: 400 })) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }
  const tz = Number(tzOffsetMin);
  const update = { $addToSet: { fcmTokens: token } };
  // real offsets run from UTC-12 to UTC+14
  if (tzOffsetMin != null && Number.isInteger(tz) && tz >= -720 && tz <= 840) update.$set = { tzOffsetMin: tz };
  await User.findByIdAndUpdate(req.user.id, update);
  return res.json({ success: true });
}

export async function removeFcmToken(req, res) {
  const { token } = req.body || {};
  if (!isNonEmptyString(token, { max: 400 })) {
    return res.status(400).json({ success: false, message: 'token is required' });
  }
  await User.findByIdAndUpdate(req.user.id, { $pull: { fcmTokens: token } });
  return res.json({ success: true });
}
