-- Email verification for public sign-up via a 6-digit OTP sent to the
-- user's email. Defaults to TRUE so every existing row (seeded admins,
-- already-registered users, Google Sign-In accounts) stays unaffected —
-- only the signup controller explicitly writes FALSE for a brand-new
-- account, until it verifies signupOtp via POST /api/auth/verify-signup-otp.
ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "signupOtp" TEXT;
ALTER TABLE "User" ADD COLUMN "signupOtpExpiry" TIMESTAMP(3);
