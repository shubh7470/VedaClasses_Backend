import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  sendOtp,
  verifyOtp,
  googleAuth,
  refresh,
  logout,
  logoutAll,
  getMe,
  changePassword,
} from './controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  googleAuthSchema,
  refreshSchema,
  changePasswordSchema,
} from './validation.js';

const router = Router();

// Rate limiters for sensitive endpoints
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait a few minutes before trying again.',
    code: 'OTP_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public Authentication Endpoints
router.post('/login', loginRateLimiter, validateRequest(loginSchema), login);
router.post('/send-otp', otpRateLimiter, validateRequest(sendOtpSchema), sendOtp);
router.post('/verify-otp', validateRequest(verifyOtpSchema), verifyOtp);
router.post('/google', validateRequest(googleAuthSchema), googleAuth);
router.post('/refresh', validateRequest(refreshSchema), refresh);
router.post('/logout', logout);

// Protected Authentication Endpoints
router.use(authenticate);
router.get('/me', getMe);
router.post('/logout-all', logoutAll);
router.post('/change-password', validateRequest(changePasswordSchema), changePassword);

export default router;
