import crypto from 'crypto';
import { User } from '../users/model.js';
import { Session } from './session.model.js';
import { Otp } from './otp.model.js';
import { Role } from '../roles/model.js';
import { Student } from '../students/model.js';
import { Lead } from '../leads/model.js';
import { AppError } from '../../common/errors/AppError.js';
import { ROLES } from '../../common/constants/roles.js';
import { comparePassword, hashPassword } from '../../common/utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  REFRESH_TOKEN_EXPIRES_DAYS,
} from '../../common/utils/jwt.js';

export const authService = {
  /**
   * User login with email and password
   */
  login: async ({ email, password, deviceInfo = {}, ipAddress = 'Unknown' }) => {
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .populate('roleIds');

    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(`Your account is ${user.status.toLowerCase()}. Please contact admin.`, 403, 'ACCOUNT_INACTIVE');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const role = user.roleIds[0]?.name || ROLES.STUDENT;

    // Check if student details exist
    let studentData = null;
    if (role === ROLES.STUDENT) {
      studentData = await Student.findOne({ userId: user._id });
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType,
      isEnrolled: studentData?.isEnrolled ?? (user.studentType === 'REGULAR'),
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({
      userId: user._id,
      refreshTokenHash: hashToken(refreshToken),
      device: deviceInfo,
      ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role,
        studentType: studentData?.studentType || user.studentType || 'REGULAR',
        isEnrolled: studentData?.isEnrolled ?? true,
      },
    };
  },

  /**
   * Send 6-digit OTP to user's email
   */
  sendOtp: async ({ email, purpose = 'GUEST_SIGNUP' }) => {
    const cleanEmail = email.toLowerCase().trim();
    // Generate secure 6-digit random code
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    // Invalidate existing active OTPs for this email and purpose
    await Otp.deleteMany({ email: cleanEmail, purpose });

    // Store OTP with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await Otp.create({
      email: cleanEmail,
      otpHash,
      purpose,
      expiresAt,
    });

    // In development / testing, log OTP clearly to console for easy developer access
    console.log(`📩 [OTP Verification] Email: ${cleanEmail} | OTP: ${rawOtp} | Purpose: ${purpose}`);

    return {
      email: cleanEmail,
      message: 'OTP has been sent to your email address.',
    };
  },

  /**
   * Verify OTP & auto-create/login Online Guest Student
   */
  verifyOtp: async ({ email, otp, name, deviceInfo = {}, ipAddress = 'Unknown' }) => {
    const cleanEmail = email.toLowerCase().trim();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      otpHash: hashedOtp,
    });

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP.', 400, 'INVALID_OTP');
    }

    // Delete OTP once verified
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find or create user
    let user = await User.findOne({ email: cleanEmail }).populate('roleIds');
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const studentRole = await Role.findOne({ name: ROLES.STUDENT });
      if (!studentRole) {
        throw new AppError('System role STUDENT is not configured.', 500, 'ROLE_MISSING');
      }

      const userName = name || cleanEmail.split('@')[0];
      user = await User.create({
        name: userName,
        email: cleanEmail,
        authProvider: 'OTP',
        studentType: 'ONLINE_GUEST',
        roleIds: [studentRole._id],
        status: 'ACTIVE',
      });
      user = await user.populate('roleIds');

      // Create Lead record
      const lead = await Lead.create({
        name: userName,
        email: cleanEmail,
        source: 'OTP_SIGNUP',
        status: 'NEW',
      });

      // Create Guest Student profile
      await Student.create({
        userId: user._id,
        studentType: 'ONLINE_GUEST',
        isEnrolled: false,
        leadId: lead._id,
        personal: { firstName: userName },
        contact: { email: cleanEmail },
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const role = user.roleIds[0]?.name || ROLES.STUDENT;
    const studentData = await Student.findOne({ userId: user._id });

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType || 'ONLINE_GUEST',
      isEnrolled: studentData?.isEnrolled ?? false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({
      userId: user._id,
      refreshTokenHash: hashToken(refreshToken),
      device: deviceInfo,
      ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role,
        studentType: studentData?.studentType || 'ONLINE_GUEST',
        isEnrolled: studentData?.isEnrolled ?? false,
      },
    };
  },

  /**
   * Google OAuth Signup / Login
   */
  googleAuth: async ({ email, name, googleId, picture, deviceInfo = {}, ipAddress = 'Unknown' }) => {
    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail }).populate('roleIds');

    if (!user) {
      const studentRole = await Role.findOne({ name: ROLES.STUDENT });
      user = await User.create({
        name,
        email: cleanEmail,
        authProvider: 'GOOGLE',
        googleId,
        profileImage: picture || null,
        studentType: 'ONLINE_GUEST',
        roleIds: [studentRole._id],
        status: 'ACTIVE',
      });
      user = await user.populate('roleIds');

      const lead = await Lead.create({
        name,
        email: cleanEmail,
        source: 'GOOGLE_SIGNUP',
        status: 'NEW',
      });

      await Student.create({
        userId: user._id,
        studentType: 'ONLINE_GUEST',
        isEnrolled: false,
        leadId: lead._id,
        personal: { firstName: name },
        contact: { email: cleanEmail },
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const role = user.roleIds[0]?.name || ROLES.STUDENT;
    const studentData = await Student.findOne({ userId: user._id });

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType || 'ONLINE_GUEST',
      isEnrolled: studentData?.isEnrolled ?? false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({
      userId: user._id,
      refreshTokenHash: hashToken(refreshToken),
      device: deviceInfo,
      ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role,
        studentType: studentData?.studentType || 'ONLINE_GUEST',
        isEnrolled: studentData?.isEnrolled ?? false,
      },
    };
  },

  /**
   * Refresh access token using refresh token
   */
  refresh: async ({ refreshToken }) => {
    if (!refreshToken) {
      throw new AppError('Refresh token is required.', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token. Please login again.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const hashed = hashToken(refreshToken);
    const session = await Session.findOne({
      refreshTokenHash: hashed,
      userId: decoded.userId,
    });

    if (!session) {
      throw new AppError('Session expired or revoked. Please login again.', 401, 'SESSION_REVOKED');
    }

    const user = await User.findById(decoded.userId).populate('roleIds');
    if (!user || user.status !== 'ACTIVE') {
      await Session.deleteOne({ _id: session._id });
      throw new AppError('User not found or inactive.', 401, 'USER_INACTIVE');
    }

    const role = user.roleIds[0]?.name || ROLES.STUDENT;
    const studentData = await Student.findOne({ userId: user._id });

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType,
      isEnrolled: studentData?.isEnrolled ?? false,
    });

    return {
      accessToken: newAccessToken,
    };
  },

  /**
   * Logout user by invalidating the refresh token session
   */
  logout: async ({ refreshToken }) => {
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await Session.deleteOne({ refreshTokenHash: hashed });
    }
    return true;
  },

  /**
   * Logout all sessions for a specific user
   */
  logoutAll: async ({ userId }) => {
    await Session.deleteMany({ userId });
    return true;
  },

  /**
   * Get current authenticated user profile
   */
  getMe: async ({ userId }) => {
    const user = await User.findById(userId).populate('roleIds');
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const role = user.roleIds[0]?.name || ROLES.STUDENT;
    let studentData = null;
    if (role === ROLES.STUDENT) {
      studentData = await Student.findOne({ userId: user._id });
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      profileImage: user.profileImage,
      role,
      studentType: studentData?.studentType || user.studentType || null,
      isEnrolled: studentData?.isEnrolled ?? (role !== ROLES.STUDENT),
      studentCode: studentData?.studentCode || null,
      createdAt: user.createdAt,
    };
  },

  /**
   * Change user password
   */
  changePassword: async ({ userId, oldPassword, newPassword }) => {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    if (!user.passwordHash) {
      throw new AppError('No password set on this account. Use set-password flow.', 400, 'PASSWORD_NOT_SET');
    }

    const isMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password does not match.', 400, 'INCORRECT_PASSWORD');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Invalidate existing sessions for security
    await Session.deleteMany({ userId: user._id });

    return true;
  },
};
