import mongoose from 'mongoose';

const mcqOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
    text: { type: String, required: true, trim: true },
    image: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const mcqSetSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      enum: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General'],
      default: 'General',
      index: true,
    },
    topicName: {
      type: String,
      trim: true,
      default: '',
    },
    accessType: {
      type: String,
      enum: ['FREE', 'PAID'],
      default: 'FREE',
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
      index: true,
    },
    marksPerQuestion: {
      type: Number,
      default: 4,
      min: 1,
    },
    negativeMarks: {
      type: Number,
      default: 1,
      min: 0,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 1,
    },
    passingMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'PUBLISHED',
      index: true,
    },
    totalQuestionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const mcqQuestionSchema = new mongoose.Schema(
  {
    setId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'McqSet',
      required: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      default: 1,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    options: {
      type: [mcqOptionSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length >= 2,
        'At least 2 options are required for an MCQ',
      ],
    },
    correctOption: {
      type: String,
      required: true,
      enum: ['A', 'B', 'C', 'D'],
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
    },
    explanationImage: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const mcqAnswerItemSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'McqQuestion', required: true },
    selectedOption: { type: String, enum: ['A', 'B', 'C', 'D', 'UNANSWERED'], default: 'UNANSWERED' },
    isCorrect: { type: Boolean, default: false },
    marksObtained: { type: Number, default: 0 },
  },
  { _id: false }
);

const mcqAttemptSchema = new mongoose.Schema(
  {
    setId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'McqSet',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'],
      default: 'SUBMITTED',
      index: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
    },
    wrongAnswers: {
      type: Number,
      default: 0,
    },
    unanswered: {
      type: Number,
      default: 0,
    },
    answers: [mcqAnswerItemSchema],
  },
  {
    timestamps: true,
  }
);

export const McqSet = mongoose.model('McqSet', mcqSetSchema);
export const McqQuestion = mongoose.model('McqQuestion', mcqQuestionSchema);
export const McqAttempt = mongoose.model('McqAttempt', mcqAttemptSchema);
