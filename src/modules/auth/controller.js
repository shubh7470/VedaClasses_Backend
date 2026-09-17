import { authService } from './service.js';
import { env } from '../../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const getDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  let type = 'WEB';
  if (/mobile/i.test(userAgent)) type = 'MOBILE';
  return {
    type,
    browser: userAgent.substring(0, 50),
    os: req.headers['sec-ch-ua-platform'] || 'Unknown',
  };
};

export const registerStudent = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    const result = await authService.registerStudent({
      firstName,
      lastName,
      email,
      phone,
      password,
      deviceInfo,
      ipAddress,
    });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return res.status(201).json({
      success: true,
      message: 'Student registration successful!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, identifier, phone, password } = req.body;
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    const result = await authService.login({
      email,
      identifier,
      phone,
      password,
      deviceInfo,
      ipAddress,
    });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const sendOtp = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;
    const result = await authService.sendOtp({ email, purpose });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { email: result.email },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp, name } = req.body;
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    const result = await authService.verifyOtp({
      email,
      otp,
      name,
      deviceInfo,
      ipAddress,
    });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: result.isNewUser ? 'Account created and logged in successfully' : 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const { email, name, googleId, picture } = req.body;
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    const result = await authService.googleAuth({
      email,
      name,
      googleId,
      picture,
      deviceInfo,
      ipAddress,
    });

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    const result = await authService.refresh({ refreshToken });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    await authService.logout({ refreshToken });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAll({ userId: req.user.id });
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Logged out from all sessions successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe({ userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: 'User profile fetched successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword({
      userId: req.user.id,
      oldPassword,
      newPassword,
    });

    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
