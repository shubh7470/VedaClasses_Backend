import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    studentType: {
      type: String,
      enum: ['REGULAR', 'ONLINE_GUEST'],
      default: 'REGULAR',
      index: true,
    },
    isEnrolled: {
      type: Boolean,
      default: function () {
        return this.studentType === 'REGULAR';
      },
      index: true,
    },
    studentCode: {
      type: String,
      unique: true,
      sparse: true, // Only regular students receive a studentCode
      index: true,
      trim: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    personal: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, trim: true, default: '' },
      dob: { type: String, default: null },
      gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], default: 'OTHER' },
    },
    contact: {
      phone: { type: String, trim: true, default: null, index: true },
      email: { type: String, required: true, lowercase: true, trim: true, index: true },
      address: {
        line1: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
      },
    },
    guardian: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, enum: ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'], default: 'FATHER' },
    },
    academic: {
      schoolName: { type: String, default: '' },
      class: { type: String, default: '' },
      board: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Student = mongoose.model('Student', studentSchema);
