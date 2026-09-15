import mongoose from 'mongoose';

const scheduleItemSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      required: true,
    },
    startTime: {
      type: String, // e.g. "08:00"
      required: true,
      trim: true,
    },
    endTime: {
      type: String, // e.g. "09:30"
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    batchCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    teachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    schedule: {
      type: [scheduleItemSchema],
      default: [],
    },
    capacity: {
      type: Number,
      default: 50,
      min: 1,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Batch = mongoose.model('Batch', batchSchema);
