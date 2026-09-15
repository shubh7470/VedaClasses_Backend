import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: false, // Optional for Google OAuth / OTP users
      select: false, // Don't return password by default in queries
    },
    authProvider: {
      type: String,
      enum: ['LOCAL', 'GOOGLE', 'OTP'],
      default: 'LOCAL',
    },
    googleId: {
      type: String,
      sparse: true,
      default: null,
    },
    studentType: {
      type: String,
      enum: ['REGULAR', 'ONLINE_GUEST', null],
      default: null,
      index: true,
    },
    roleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        index: true,
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to safely serialize user object without sensitive fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
