import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #16241C;">
      <h2 style="margin: 0 0 12px;">Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Welcome to <strong>MyHealthBook</strong>! Tap the button below on this device to verify your email and continue creating your account.</p>
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
