import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { isNonEmptyString } from '../utils/validators.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}

function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/* One endpoint serves both Login's and Register's "Continue with
   Google" button — there's no separate Google-register flow, the
   server just decides create-vs-login by whether the email already
   exists. An account that was originally created via email/password
   gets its googleId backfilled on first Google sign-in rather than
   erroring or creating a duplicate. */
export async function googleSignIn(req, res) {
  const { idToken } = req.body || {};

  if (!isNonEmptyString(idToken, { max: 4096 })) {
    return res.status(400).json({ success: false, message: 'idToken is required' });
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired Google token' });
  }

  const { email, name, sub: googleId } = payload || {};
  if (!email) {
    return res.status(400).json({ success: false, message: 'Google did not return an email address' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (!existingUser.googleId) {
      existingUser.googleId = googleId;
      await existingUser.save();
    }
    const token = signToken(existingUser);
    return res.json({ success: true, token, user: publicUser(existingUser), isNewUser: false });
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  const user = await User.create({
    name: name || 'MyHealthBook User',
    email: normalizedEmail,
    phone: '',
    passwordHash,
    googleId,
    isEmailVerified: true,
  });

  const token = signToken(user);
  return res.status(201).json({ success: true, token, user: publicUser(user), isNewUser: true });
}
