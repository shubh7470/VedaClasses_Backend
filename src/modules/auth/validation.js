import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
    password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
  }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    oldPassword: z.string({ required_error: 'Old password is required' }).min(1, 'Old password cannot be empty'),
    newPassword: z.string({ required_error: 'New password is required' }).min(6, 'New password must be at least 6 characters'),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string({ required_error: 'Reset token is required' }),
    newPassword: z.string({ required_error: 'New password is required' }).min(6, 'New password must be at least 6 characters'),
  }),
};

export const sendOtpSchema = {
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
    purpose: z.enum(['GUEST_SIGNUP', 'LOGIN', 'PASSWORD_RESET']).optional(),
  }),
};

export const verifyOtpSchema = {
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
    otp: z.string({ required_error: 'OTP is required' }).length(6, 'OTP must be 6 digits'),
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  }),
};

export const googleAuthSchema = {
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
    name: z.string({ required_error: 'Name is required' }).min(1),
    googleId: z.string({ required_error: 'Google ID is required' }),
    picture: z.string().optional(),
  }),
};
