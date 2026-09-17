import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['FREE_MCQ_TEST', 'GOOGLE_SIGNUP', 'OTP_SIGNUP', 'WEBSITE', 'ADMIN_MANUAL', 'SELF_REGISTER'],
      default: 'WEBSITE',
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'INTERESTED', 'CONVERTED', 'CLOSED'],
      default: 'NEW',
      index: true,
    },
    convertedToAdmission: {
      type: Boolean,
      default: false,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Lead = mongoose.model('Lead', leadSchema);
