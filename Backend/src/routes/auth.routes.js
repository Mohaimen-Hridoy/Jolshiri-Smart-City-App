const express = require('express');
const {
  signup, login, googleSignIn, me, updateProfile,
  changePassword, verifySignupOtp, resendSignupOtp,
  updateFcmToken,
  changeRole,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-signup-otp', verifySignupOtp); // confirm the OTP emailed at signup, then get the login token
router.post('/resend-signup-otp', resendSignupOtp);
router.post('/login', login);
router.post('/sso/google', googleSignIn);       // Google Sign-In (Firebase ID token)
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);
router.patch('/fcm-token', authenticate, updateFcmToken);

router.patch('/role', authenticate, changeRole);

module.exports = router;
