import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import readingsRoutes from './routes/readingsRoutes.js';
import recordsRoutes from './routes/recordsRoutes.js';
import medsRoutes from './routes/medsRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import coachRoutes from './routes/coachRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import { performEmailVerification } from './controllers/authController.js';
import './utils/firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok' }));

/* Digital Asset Links / Universal Links verification files — must be
   served exactly at this path, at the domain root, for Android App
   Links (autoVerify) and iOS Universal Links to trust this app. */
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(publicDir, '.well-known', 'assetlinks.json'));
});
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(publicDir, '.well-known', 'apple-app-site-association'));
});

/* Web fallback for the email verification link — reached only when
   the app isn't installed, or Android/iOS haven't finished verifying
   the App Link yet, so the tap opens a normal browser instead of the
   app directly. Verifies the same way the app's own deep-link handler
   does (performEmailVerification), then shows a plain result page. */
app.get('/verify', async (req, res) => {
  const { token, email } = req.query;
  const result = await performEmailVerification(email, token);
  const message = result.ok
    ? result.alreadyVerified
      ? 'Your email was already verified — you can return to the MyHealthBook app.'
      : 'Your email has been verified! Return to the MyHealthBook app to finish creating your account.'
    : result.message || 'This verification link is invalid.';
  res.type('html').send(`
    <!DOCTYPE html>
    <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: Arial, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; text-align: center; color: #16241C;">
      <h2>${result.ok ? '✓ MyHealthBook' : 'MyHealthBook'}</h2>
      <p style="font-size: 16px; line-height: 1.5;">${message}</p>
    </body></html>
  `);
});

app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/meds', medsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/coach', coachRoutes);
// PayU's success/failure callback posts application/x-www-form-urlencoded,
// not JSON — scoped to just this route rather than added globally.
app.use('/api/payments', express.urlencoded({ extended: true }), paymentRoutes);
app.use('/api/insights', insightsRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
