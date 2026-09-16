const nodemailer = require('nodemailer');

/// Returns a configured Nodemailer transporter using Gmail SMTP.
/// Requires GMAIL_USER and GMAIL_APP_PASSWORD in .env
/// (App Password — NOT your regular Gmail password. Generate one at:
///  https://myaccount.google.com/apppasswords  →  2-Step Verification must be ON)
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null; // email not configured — fall back to console log
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    // Bug fix: without these, a blocked/filtered outbound SMTP port (very
    // common on cloud hosts like Railway/Render) makes the TCP connect
    // attempt hang for a long time (OS-level timeouts can be 60s+) instead
    // of failing fast. That hang held the whole HTTP request open past the
    // Flutter app's 20s client timeout, which is exactly what showed up as
    // "Can't reach the server" on forgot-password / resend-OTP even though
    // the backend itself was up the whole time. Capping these means a
    // broken mail path now fails in ~8s and falls through to the
    // dev-fallback code path below instead of hanging the request.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

/// Sends a password-reset OTP email to the given address.
/// Falls back to printing the OTP in the console if Gmail is not configured
/// OR if the send genuinely fails/times out (see connectionTimeout above) —
/// either way the caller still gets a usable OTP back.
async function sendOtpEmail(toEmail, otp) {
  const transporter = getTransporter();

  if (!transporter) {
    // Not configured — log to console so development still works without email
    console.log(`[email:mock] OTP for ${toEmail}: ${otp}`);
    return { sent: false, mocked: true };
  }

  const from = `"Jolshiri Smart City" <${process.env.GMAIL_USER}>`;

  try {
    await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Your Jolshiri password reset code',
    text: `Your 6-digit reset code is: ${otp}\n\nThis code expires in 15 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#1a3c5e;border-radius:50%;width:56px;height:56px;line-height:56px;">
            <span style="font-size:28px;">🏙️</span>
          </div>
          <h2 style="margin:12px 0 4px;color:#1a3c5e;">Jolshiri Smart City</h2>
          <p style="color:#6b7280;margin:0;font-size:14px;">Password Reset</p>
        </div>

        <p style="color:#374151;font-size:15px;">
          We received a request to reset your password. Use the code below — it expires in <strong>15 minutes</strong>.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#f3f4f6;border-radius:10px;padding:18px 36px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a3c5e;">${otp}</span>
          </div>
        </div>

        <p style="color:#6b7280;font-size:13px;text-align:center;">
          If you did not request a password reset, you can safely ignore this email.
          <br>Do <strong>not</strong> share this code with anyone.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
          Jolshiri Smart City &mdash; Dhaka, Bangladesh
        </p>
      </div>
    `,
    });
  } catch (err) {
    console.error(`[email] failed to send reset code to ${toEmail}: ${err.message}`);
    console.log(`[email:mock] OTP for ${toEmail}: ${otp}`);
    return { sent: false, mocked: true };
  }

  return { sent: true };
}

/// Sends a sign-up email-verification OTP to the given address.
/// Falls back to printing the OTP in the console if Gmail is not configured
/// or the send fails/times out. (Kept for the optional resend-otp endpoint;
/// signup itself no longer requires OTP verification — see auth.controller.js.)
async function sendSignupVerificationEmail(toEmail, otp, fullName) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[email:mock] Signup verification OTP for ${toEmail}: ${otp}`);
    return { sent: false, mocked: true };
  }

  const from = `"Jolshiri Smart City" <${process.env.GMAIL_USER}>`;
  const greetName = fullName ? fullName.split(' ')[0] : 'there';

  try {
    await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Verify your Jolshiri account',
    text: `Hi ${greetName},\n\nYour 6-digit verification code is: ${otp}\n\nThis code expires in 15 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#1a3c5e;border-radius:50%;width:56px;height:56px;line-height:56px;">
            <span style="font-size:28px;">🏙️</span>
          </div>
          <h2 style="margin:12px 0 4px;color:#1a3c5e;">Jolshiri Smart City</h2>
          <p style="color:#6b7280;margin:0;font-size:14px;">Verify your email</p>
        </div>

        <p style="color:#374151;font-size:15px;">
          Hi ${greetName}, welcome to Jolshiri! Use the code below to verify your email and finish creating your account — it expires in <strong>15 minutes</strong>.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#f3f4f6;border-radius:10px;padding:18px 36px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a3c5e;">${otp}</span>
          </div>
        </div>

        <p style="color:#6b7280;font-size:13px;text-align:center;">
          If you didn't create a Jolshiri account, you can safely ignore this email.
          <br>Do <strong>not</strong> share this code with anyone.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">
          Jolshiri Smart City &mdash; Dhaka, Bangladesh
        </p>
      </div>
    `,
    });
  } catch (err) {
    console.error(`[email] failed to send signup OTP to ${toEmail}: ${err.message}`);
    console.log(`[email:mock] Signup verification OTP for ${toEmail}: ${otp}`);
    return { sent: false, mocked: true };
  }

  return { sent: true };
}

module.exports = { sendOtpEmail, sendSignupVerificationEmail };
