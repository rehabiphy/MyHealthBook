import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/* Password reset still uses a typed 6-digit code — registration used
   to as well, but now sends a clickable link instead (see
   sendVerificationLinkEmail below), so this is reset-only. */
export async function sendOtpEmail({ to, name, otp }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #16241C;">
      <h2 style="margin: 0 0 12px;">Reset your password</h2>
      <p>Hi ${name}, enter this code in the app to continue resetting your password.</p>
      <p style="text-align: center; margin: 32px 0;">
        <span style="display: inline-block; background-color: #F0FDF4; border: 1px solid #BBF7D0; color: #16241C; padding: 16px 32px; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
          ${otp}
        </span>
      </p>
      <p style="font-size: 13px; color: #6B7280;">This code is valid for 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"MyHealthBook" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your MyHealthBook password',
    text: `Hi ${name}, enter this code in the app to continue resetting your password. Your code: ${otp} (valid for 10 minutes)`,
    html,
  });
}

/* Registration verification: a real clickable button, deep-linking
   straight back into the app via an Android App Link / iOS Universal
   Link (see backend/public/.well-known/) — no code to type. Falls
   back to a plain-text link for mail clients that strip button
   markup, and to the GET /verify web page (app.js) if the app isn't
   installed or App Links verification hasn't gone through yet. */
export async function sendVerificationLinkEmail({ to, name, verifyUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #16241C;">
      <h2 style="margin: 0 0 12px;">Verify your email</h2>
      <p>Welcome to <strong>MyHealthBook</strong>, ${name}! Tap the button below on this device to verify your email and finish creating your account.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="background-color: #22C55E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block;">
          Verify My Email
        </a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">If the button doesn't work, copy and paste this link on your device:<br />
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">This link is valid for 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"MyHealthBook" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Verify your MyHealthBook email',
    text: `Hi ${name}, verify your MyHealthBook email by opening this link on your device: ${verifyUrl} (valid for 10 minutes)`,
    html,
  });
}
