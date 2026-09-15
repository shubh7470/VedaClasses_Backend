import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['GUEST_SIGNUP', 'LOGIN', 'PASSWORD_RESET'],
      default: 'GUEST_SIGNUP',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Auto-delete on expiry via MongoDB TTL
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Otp = mongoose.model('Otp', otpSchema);
