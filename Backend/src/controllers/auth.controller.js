const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const { signToken } = require('../utils/jwt');
const { signupSchema, loginSchema } = require('../utils/validation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendOtpEmail, sendSignupVerificationEmail } = require('../services/emailService');

const SALT_ROUNDS = 10;
const OTP_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes, matches forgot-password OTP

// Never send the password hash or OTP bookkeeping fields back to the client.
function toPublicUser(user) {
  const { passwordHash, resetToken, resetTokenExpiry, signupOtp, signupOtpExpiry, ...publicUser } = user;
  return publicUser;
}

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/// POST /api/auth/signup
/// Creates the account and immediately signs the user in — no email OTP
/// gate. (Email verification via OTP used to be mandatory here, but the
/// mail step was unreliable on the deployed server — see notes on
/// `login` below — and blocked people from ever getting into the app.
/// The account is created as isEmailVerified: true and a login token is
/// returned right away, matching the old `login` response shape so the
/// client can log the user straight in without a separate step.)
const signup = asyncHandler(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: data.role,
          // Public signup can never create an ADMIN account (see
          // PUBLIC_SIGNUP_ROLES in utils/validation.js) — adminType is only
          // ever set by prisma/seed.js or a trusted internal admin tool.
          adminType: null,
          address: data.address,
          plotNumber: data.role === 'RESIDENT_OWNER' ? data.plotNumber : null,
          sectorNumber: data.role === 'RESIDENT_OWNER' ? data.sectorNumber : null,
          constructionStatus: data.role === 'RESIDENT_OWNER' ? data.constructionStatus : null,
          rentStatus: data.role === 'RESIDENT_OWNER' ? data.rentStatus : null,
          // No OTP gate — accounts are verified immediately on signup.
          isEmailVerified: true,
        },
      });

      if (data.role === 'DEVELOPER') {
        await tx.developer.create({
          data: {
            userId: created.id,
            companyName: data.companyName,
            contact: data.phone,
            specialty: data.specialty,
          },
        });
      }

      if (data.role === 'SERVICE_PROVIDER') {
        await tx.serviceProvider.create({
          data: {
            userId: created.id,
            name: data.fullName,
            serviceType: data.serviceType,
            phone: data.phone,
          },
        });
      }

      return created;
    });
  } catch (err) {
    // Race-condition guard: two concurrent signups with the same email can
    // both pass the findUnique check above before either commits. The
    // database's unique index on User.email (P2002) is the real backstop —
    // surface it as the same friendly 409 instead of a generic 500, so an
    // email can never end up backing two stakeholder accounts either way.
    if (err.code === 'P2002') {
      throw new ApiError(409, 'An account with this email already exists');
    }
    throw err;
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({ token, user: toPublicUser(user), needsVerification: false });
});

/// POST /api/auth/verify-signup-otp
/// Confirms the OTP emailed at signup, marks the account verified, and
/// only now issues the login JWT.
const verifySignupOtp = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    otp: z.string().length(6, 'Invalid verification code'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification code');
  }

  // Already verified (e.g. double-submit) — just let them in.
  if (user.isEmailVerified) {
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ token, user: toPublicUser(user) });
  }

  if (!user.signupOtp || user.signupOtp !== parsed.data.otp) {
    throw new ApiError(400, 'Invalid or expired verification code');
  }
  if (!user.signupOtpExpiry || user.signupOtpExpiry < new Date()) {
    throw new ApiError(400, 'Verification code has expired — please request a new one');
  }

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, signupOtp: null, signupOtpExpiry: null },
  });

  const token = signToken({ sub: verified.id, role: verified.role });
  res.json({ token, user: toPublicUser(verified) });
});

/// POST /api/auth/resend-signup-otp
const resendSignupOtp = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({ email: z.string().trim().toLowerCase().email('Invalid email address') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  // Same-shaped response either way — avoids leaking whether an account
  // exists or is already verified.
  const SAFE_RESPONSE = { message: 'If that account needs verification, a new code has been sent.' };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.isEmailVerified) {
    return res.json(SAFE_RESPONSE);
  }

  const otp = generateOtp();
  const signupOtpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);
  await prisma.user.update({
    where: { id: user.id },
    data: { signupOtp: otp, signupOtpExpiry },
  });

  const emailResult = await sendSignupVerificationEmail(user.email, otp, user.fullName);
  // Same fix as signup() above — always surface the code when it genuinely
  // couldn't be emailed, regardless of NODE_ENV.
  const devOtp = !emailResult.sent ? otp : undefined;

  res.json({ ...SAFE_RESPONSE, ...(devOtp ? { otp: devOtp } : {}) });
});

/// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Email-OTP verification used to be required before login (403 here),
  // but the OTP email was unreliable on the deployed server (Gmail SMTP is
  // frequently blocked/timed out from cloud hosts like Railway) and this
  // gate was locking people out of the app on every single login, not just
  // signup. Login no longer depends on isEmailVerified at all — the flag is
  // kept on the User row for reference only.

  // Bug 1 Fix: SUSPENDED or BANNED accounts must not be able to log in.
  // Without this check an admin could be suspended via the admin panel but
  // still sign in and issue a fresh token that bypasses the authenticate-
  // middleware check below.
  if (user.accountStatus === 'SUSPENDED') {
    throw new ApiError(403, 'Your account has been suspended. Please contact the administrator.');
  }
  if (user.accountStatus === 'BANNED') {
    throw new ApiError(403, 'Your account has been permanently banned. Please contact the administrator.');
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: toPublicUser(user) });
});

/// POST /api/auth/sso/google
/// Verifies a Firebase ID token from the Flutter Google Sign-In flow,
/// then creates or finds the user account and returns a Jolshiri JWT.
///
/// Flutter sends:  { idToken: "<firebase id token>", role?: "RESIDENT_OWNER" }
/// The role is only needed on first sign-in (account creation).
const googleSignIn = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({
    idToken: z.string().min(10, 'Invalid Firebase ID token'),
    role: z.enum(['RESIDENT_OWNER', 'DEVELOPER', 'SERVICE_PROVIDER']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  // Verify the Firebase ID token using Firebase Admin SDK
  const { getFirebaseAdmin } = require('../config/firebase');
  const admin = getFirebaseAdmin();
  if (!admin) {
    throw new ApiError(503, 'Google Sign-In is not configured on this server. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
  }

  let firebaseUser;
  try {
    firebaseUser = await admin.auth().verifyIdToken(parsed.data.idToken);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired Google token — please sign in again');
  }

  const { uid: googleUid, name: fullName, picture: avatarUrl } = firebaseUser;

  if (!firebaseUser.email) {
    throw new ApiError(400, 'Google account has no email address');
  }
  // Bug fix: Firebase returns the email in whatever case the Google
  // account has it in, but the password-signup path always normalizes to
  // lowercase (see signupSchema). Comparing/storing this raw, un-lowercased
  // value meant someone who already had a password account (e.g.
  // "john@gmail.com") could sign in with Google under
  // "John@gmail.com" — the findFirst below wouldn't match the existing
  // row (Postgres string equality is case-sensitive), so a second User row
  // got created for the same real-world email, sometimes under a
  // different role. That's how one email ended up able to register as
  // multiple stakeholders. Normalize the same way signup does before any
  // lookup or write.
  const email = firebaseUser.email.trim().toLowerCase();

  // Find existing user by email or Google UID
  let user = await prisma.user.findFirst({
    where: { OR: [{ email }, { googleUid }] },
  });

  if (user) {
    // Bug fix: the regular password `login` above blocks SUSPENDED/BANNED
    // accounts, but this existing-user branch of googleSignIn issued a
    // token regardless of accountStatus. The Flutter app treats a
    // successful token response as a successful login and navigates
    // straight to the dashboard — the fact that every subsequent API call
    // would then 403 (via the authenticate middleware's own re-check)
    // happens silently in background sync calls, so a suspended/banned
    // user could still reach the full app UI through Google Sign-In,
    // bypassing the suspension entirely. Block it here too, matching login.
    if (user.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'Your account has been suspended. Please contact the administrator.');
    }
    if (user.accountStatus === 'BANNED') {
      throw new ApiError(403, 'Your account has been permanently banned. Please contact the administrator.');
    }

    // Existing user — update googleUid if this is the first Google login
    if (!user.googleUid) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleUid },
      });
    }
  } else {
    // New user — create account. Role defaults to RESIDENT_OWNER if not sent.
    const role = parsed.data.role ?? 'RESIDENT_OWNER';
    const resolvedName = fullName ?? email.split('@')[0];

    // Google Sign-In collects no serviceType/companyName/specialty, so a
    // DEVELOPER or SERVICE_PROVIDER signing up this way used to end up with
    // a User row but no Developer/ServiceProvider row — every provider- or
    // developer-only endpoint (bookings, quotes, meetings, etc.) then 404'd
    // with "No profile for this account". Create the profile row here too,
    // with placeholder values the person can fill in from
    // Provider/Developer Dashboard → My Profile (PATCH /providers/me or
    // /developers/me) right after their first login.
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: resolvedName,
          email,
          googleUid,
          role,
          // Google users have no password — set a random unguessable hash
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS),
        },
      });

      if (role === 'DEVELOPER') {
        await tx.developer.create({
          data: {
            userId: created.id,
            companyName: resolvedName,
            contact: '',
            specialty: 'General',
          },
        });
      }

      if (role === 'SERVICE_PROVIDER') {
        await tx.serviceProvider.create({
          data: {
            userId: created.id,
            name: resolvedName,
            serviceType: 'General',
            phone: '',
          },
        });
      }

      return created;
    });
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: toPublicUser(user) });
});

/// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

/// PATCH /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({
    fullName: z.string().trim().min(2, 'Full name is too short').optional(),
    phone: z.string().trim().min(6, 'Invalid phone number').optional(),
    address: z.string().trim().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: parsed.data,
  });
  res.json({ user: toPublicUser(updated) });
});

/// POST /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({
    currentPassword: z.string().min(1, 'currentPassword is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) throw new ApiError(401, 'Current password is incorrect');

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: 'Password changed successfully' });
});

/// POST /api/auth/forgot-password
/// Generates a 6-digit OTP, saves it to the User row, and emails it
/// via Gmail (Nodemailer). Falls back to console log if Gmail is not configured.
const forgotPassword = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({ email: z.string().email('Invalid email address') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  // Always return the same message — prevents user-enumeration attacks.
  const SAFE_RESPONSE = { message: 'If that email is registered, a reset code has been sent.' };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return res.json(SAFE_RESPONSE);
  }

  // Generate 6-digit OTP, valid for 15 minutes
  const otp = crypto.randomInt(100000, 999999).toString();
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: otp, resetTokenExpiry },
  });

  // Send the OTP via email (Gmail / Nodemailer)
  const emailResult = await sendOtpEmail(parsed.data.email, otp);

  // Same fix as signup() above — always surface the code when it genuinely
  // couldn't be emailed (e.g. GMAIL_USER/GMAIL_APP_PASSWORD not set on the
  // deployed server), regardless of NODE_ENV, so this is never a dead end.
  const devToken = !emailResult.sent ? otp : undefined;

  res.json({ ...SAFE_RESPONSE, ...(devToken ? { token: devToken } : {}) });
});

/// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { z } = require('zod');
  const schema = z.object({
    email: z.string().email('Invalid email'),
    token: z.string().length(6, 'Invalid reset code'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.resetToken !== parsed.data.token) {
    throw new ApiError(400, 'Invalid or expired reset code');
  }
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw new ApiError(400, 'Reset code has expired — please request a new one');
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  res.json({ message: 'Password reset successfully' });
});

/// PATCH /api/auth/fcm-token
const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken || typeof fcmToken !== 'string') {
    throw new ApiError(400, 'fcmToken is required');
  }
  await prisma.user.update({
    where: { id: req.user.id }, // fixed: was req.user.sub
    data: { fcmToken },
  });
  res.json({ message: 'FCM token updated' });
});


/// PATCH /api/auth/role — resident or provider switches their own account role.
/// Admin role can never be self-assigned through this endpoint.
const changeRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const PUBLIC_ROLES = ['RESIDENT_OWNER', 'SERVICE_PROVIDER', 'DEVELOPER'];
  if (!PUBLIC_ROLES.includes(role)) {
    throw new ApiError(400, 'Invalid role — must be RESIDENT_OWNER, SERVICE_PROVIDER, or DEVELOPER');
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { role },
  });
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } });
});

module.exports = {
  signup, login, googleSignIn, me, updateProfile, changePassword,
  verifySignupOtp, resendSignupOtp,
  forgotPassword, resetPassword, updateFcmToken,
  changeRole,
};
