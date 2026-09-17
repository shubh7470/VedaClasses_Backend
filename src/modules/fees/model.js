import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    reason: { type: String, trim: true, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const studentFeeStructureSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: discountSchema,
      default: () => ({}),
    },
    netPayable: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPending: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID_FULL', 'OVERDUE'],
      default: 'UNPAID',
      index: true,
    },
    installmentsCount: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

const feeInstallmentSchema = new mongoose.Schema(
  {
    studentFeeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentFeeStructure',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    installmentNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
      default: 'PENDING',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const feePaymentSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    studentFeeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentFeeStructure',
      required: true,
      index: true,
    },
    installmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeInstallment',
      default: null,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'UPI_DIRECT', 'BANK_TRANSFER', 'CHEQUE', 'CARD_POS'],
      required: true,
    },
    transactionRefNo: {
      type: String,
      trim: true,
      default: '',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const StudentFeeStructure = mongoose.model('StudentFeeStructure', studentFeeStructureSchema);
export const FeeInstallment = mongoose.model('FeeInstallment', feeInstallmentSchema);
export const FeePayment = mongoose.model('FeePayment', feePaymentSchema);
