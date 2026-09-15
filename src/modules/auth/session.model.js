import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    device: {
      type: {
        type: String,
        enum: ['WEB', 'MOBILE', 'DESKTOP', 'UNKNOWN'],
        default: 'WEB',
      },
      browser: { type: String, default: 'Unknown' },
      os: { type: String, default: 'Unknown' },
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: automatically deletes document once expiresAt is reached
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Session = mongoose.model('Session', sessionSchema);
