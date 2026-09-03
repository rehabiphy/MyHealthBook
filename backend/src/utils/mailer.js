import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const COPY = {
  register: {
    subject: 'Verify your MyHealthBook email',
    heading: 'Verify your email',
    intro: name => `Welcome to <strong>MyHealthBook</strong>, ${name}! Enter this code in the app to verify your email and finish creating your account.`,
  },
  reset: {
    subject: 'Reset your MyHealthBook password',
    heading: 'Reset your password',
    intro: name => `Hi ${name}, enter this code in the app to continue resetting your password.`,
  },
};

export async function sendOtpEmail({ to, name, otp, purpose = 'register' }) {
  const copy = COPY[purpose] || COPY.register;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #16241C;">
      <h2 style="margin: 0 0 12px;">${copy.heading}</h2>
      <p>${copy.intro(name)}</p>
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
    subject: copy.subject,
    text: `${copy.intro(name).replace(/<[^>]+>/g, '')} Your code: ${otp} (valid for 10 minutes)`,
    html,
  });
}
