const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.PUBLIC_URL}/verify-email.html?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: linear-gradient(135deg, #ff6b35 0%, #ff8555 100%); color: white; padding: 32px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0;">Verify Your Email</h1>
      </div>

      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; color: #1f2937;">Thank you for creating an account with Estimator!</p>
        <p style="color: #6b7280;">Please verify your email address by clicking the button below:</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #ff6b35; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Verify Email
          </a>
        </div>

        <p style="font-size: 14px; color: #9ca3af;">Or copy this link: <a href="${verifyUrl}" style="color: #ff6b35;">${verifyUrl}</a></p>
        <p style="font-size: 14px; color: #9ca3af; margin-top: 24px;">This link expires in 24 hours.</p>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email.toLowerCase().trim(),
    subject: 'Verify your email address',
    html,
  });
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.PUBLIC_URL}/reset-password.html?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: linear-gradient(135deg, #ff6b35 0%, #ff8555 100%); color: white; padding: 32px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0;">Reset Your Password</h1>
      </div>

      <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; color: #1f2937;">You requested a password reset.</p>
        <p style="color: #6b7280;">Click the button below to reset your password:</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #ff6b35; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 14px; color: #9ca3af;">Or copy this link: <a href="${resetUrl}" style="color: #ff6b35;">${resetUrl}</a></p>
        <p style="font-size: 14px; color: #9ca3af; margin-top: 24px;">This link expires in 1 hour.</p>
        <p style="font-size: 14px; color: #ef4444; margin-top: 16px;">If you didn't request this, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: email.toLowerCase().trim(),
    subject: 'Reset your password',
    html,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
