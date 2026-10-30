import crypto from 'crypto';
import { prisma } from '../../config/database.js';
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
   * User login with email or mobile phone number and password
   */
  login: async ({ email, identifier, phone, password, deviceInfo = {}, ipAddress = 'Unknown' }) => {
    const cleanId = (identifier || email || phone || '').toLowerCase().trim();
    if (!cleanId) {
      throw new AppError('Email or mobile number is required.', 400, 'MISSING_IDENTIFIER');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanId }, { phone: cleanId }],
      },
      include: {
        roles: true,
        student: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email/mobile number or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(`Your account is ${user.status.toLowerCase()}. Please contact admin.`, 403, 'ACCOUNT_INACTIVE');
    }

    if (!user.passwordHash) {
      throw new AppError('Password login is not enabled for this account. Please use Google or OTP login.', 400, 'NO_PASSWORD_SET');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const role = user.roles[0]?.name || ROLES.STUDENT;
    const studentData = user.student;

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType,
      isEnrolled: studentData?.isEnrolled ?? (user.studentType === 'REGULAR'),
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        deviceType: deviceInfo.type || 'WEB',
        browser: deviceInfo.browser || 'Unknown',
        os: deviceInfo.os || 'Unknown',
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        _id: user.id,
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
   * Self-registration for Online Guest Student (Name, Phone, Email, Password)
   */
  registerStudent: async ({ firstName, lastName = '', email, phone, password, deviceInfo = {}, ipAddress = 'Unknown' }) => {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    // Check if user already exists with email or phone
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { phone: cleanPhone }],
      },
    });

    if (existingUser) {
      throw new AppError('An account with this email or mobile number already exists.', 400, 'USER_ALREADY_EXISTS');
    }

    const studentRole = await prisma.role.findUnique({ where: { name: ROLES.STUDENT } });
    if (!studentRole) {
      throw new AppError('STUDENT role is not configured.', 500, 'ROLE_MISSING');
    }

    const passwordHash = await hashPassword(password);
    const fullName = `${firstName} ${lastName}`.trim();

    // Create User, Lead, and Student in a transaction
    const { user, student } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: fullName,
          email: cleanEmail,
          phone: cleanPhone,
          passwordHash,
          authProvider: 'LOCAL',
          studentType: 'ONLINE_GUEST',
          status: 'ACTIVE',
          lastLoginAt: new Date(),
          roles: {
            connect: [{ id: studentRole.id }],
          },
        },
      });

      const newLead = await tx.lead.create({
        data: {
          name: fullName,
          email: cleanEmail,
          phone: cleanPhone,
          source: 'SELF_REGISTER',
          status: 'NEW',
        },
      });

      const newStudent = await tx.student.create({
        data: {
          userId: newUser.id,
          studentType: 'ONLINE_GUEST',
          isEnrolled: false,
          leadId: newLead.id,
          personal: { firstName, lastName },
          contact: { email: cleanEmail, phone: cleanPhone },
        },
      });

      return { user: newUser, student: newStudent };
    });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: ROLES.STUDENT,
      studentType: 'ONLINE_GUEST',
      isEnrolled: false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        deviceType: deviceInfo.type || 'WEB',
        browser: deviceInfo.browser || 'Unknown',
        os: deviceInfo.os || 'Unknown',
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        _id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: ROLES.STUDENT,
        studentType: 'ONLINE_GUEST',
        isEnrolled: false,
      },
    };
  },

  /**
   * Send 6-digit OTP to user's email
   */
  sendOtp: async ({ email, purpose = 'GUEST_SIGNUP' }) => {
    const cleanEmail = email.toLowerCase().trim();
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

    // Invalidate existing active OTPs for this email and purpose
    await prisma.otp.deleteMany({
      where: {
        email: cleanEmail,
        purpose,
      },
    });

    // Store OTP with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.otp.create({
      data: {
        email: cleanEmail,
        otpHash,
        purpose,
        expiresAt,
      },
    });

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

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: cleanEmail,
        otpHash: hashedOtp,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      throw new AppError('Invalid or expired OTP.', 400, 'INVALID_OTP');
    }

    // Delete OTP once verified
    await prisma.otp.delete({ where: { id: otpRecord.id } });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { roles: true, student: true },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const studentRole = await prisma.role.findUnique({ where: { name: ROLES.STUDENT } });
      if (!studentRole) {
        throw new AppError('System role STUDENT is not configured.', 500, 'ROLE_MISSING');
      }

      const userName = name || cleanEmail.split('@')[0];

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: userName,
            email: cleanEmail,
            authProvider: 'OTP',
            studentType: 'ONLINE_GUEST',
            status: 'ACTIVE',
            roles: {
              connect: [{ id: studentRole.id }],
            },
          },
          include: { roles: true },
        });

        const newLead = await tx.lead.create({
          data: {
            name: userName,
            email: cleanEmail,
            source: 'OTP_SIGNUP',
            status: 'NEW',
          },
        });

        const newStudent = await tx.student.create({
          data: {
            userId: newUser.id,
            studentType: 'ONLINE_GUEST',
            isEnrolled: false,
            leadId: newLead.id,
            personal: { firstName: userName },
            contact: { email: cleanEmail },
          },
        });

        return { ...newUser, student: newStudent };
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const role = user.roles[0]?.name || ROLES.STUDENT;
    const studentData = user.student;

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType || 'ONLINE_GUEST',
      isEnrolled: studentData?.isEnrolled ?? false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        deviceType: deviceInfo.type || 'WEB',
        browser: deviceInfo.browser || 'Unknown',
        os: deviceInfo.os || 'Unknown',
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        id: user.id,
        _id: user.id,
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
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { roles: true, student: true },
    });

    if (!user) {
      const studentRole = await prisma.role.findUnique({ where: { name: ROLES.STUDENT } });
      if (!studentRole) {
        throw new AppError('System role STUDENT is not configured.', 500, 'ROLE_MISSING');
      }

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name,
            email: cleanEmail,
            authProvider: 'GOOGLE',
            googleId,
            profileImage: picture || null,
            studentType: 'ONLINE_GUEST',
            status: 'ACTIVE',
            roles: {
              connect: [{ id: studentRole.id }],
            },
          },
          include: { roles: true },
        });

        const newLead = await tx.lead.create({
          data: {
            name,
            email: cleanEmail,
            source: 'GOOGLE_SIGNUP',
            status: 'NEW',
          },
        });

        const newStudent = await tx.student.create({
          data: {
            userId: newUser.id,
            studentType: 'ONLINE_GUEST',
            isEnrolled: false,
            leadId: newLead.id,
            personal: { firstName: name },
            contact: { email: cleanEmail },
          },
        });

        return { ...newUser, student: newStudent };
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const role = user.roles[0]?.name || ROLES.STUDENT;
    const studentData = user.student;

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role,
      studentType: studentData?.studentType || user.studentType || 'ONLINE_GUEST',
      isEnrolled: studentData?.isEnrolled ?? false,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        deviceType: deviceInfo.type || 'WEB',
        browser: deviceInfo.browser || 'Unknown',
        os: deviceInfo.os || 'Unknown',
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        _id: user.id,
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
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: hashed },
    });

    if (!session || session.userId !== decoded.userId || new Date(session.expiresAt) <= new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new AppError('Session expired or revoked. Please login again.', 401, 'SESSION_REVOKED');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { roles: true, student: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new AppError('User not found or inactive.', 401, 'USER_INACTIVE');
    }

    const role = user.roles[0]?.name || ROLES.STUDENT;
    const studentData = user.student;

    const newAccessToken = generateAccessToken({
      userId: user.id,
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
      await prisma.session.deleteMany({
        where: { refreshTokenHash: hashed },
      });
    }
    return true;
  },

  /**
   * Logout all sessions for a specific user
   */
  logoutAll: async ({ userId }) => {
    await prisma.session.deleteMany({
      where: { userId },
    });
    return true;
  },

  /**
   * Get current authenticated user profile
   */
  getMe: async ({ userId }) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, student: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const role = user.roles[0]?.name || ROLES.STUDENT;
    const studentData = user.student;

    return {
      id: user.id,
      _id: user.id,
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

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

    const newHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return true;
  },
};
