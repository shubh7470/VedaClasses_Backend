import mongoose from 'mongoose';
import { StudentFeeStructure, FeeInstallment, FeePayment } from './model.js';
import { Student } from '../students/model.js';
import { AppError } from '../../common/errors/AppError.js';

export const createFeeStructure = async (data, userId) => {
  const { studentId, courseId, batchId, grossAmount, discount, installments } = data;

  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  const discountAmount = discount?.amount || 0;
  const netPayable = grossAmount - discountAmount;
  if (netPayable < 0) {
    throw new AppError('Discount cannot be greater than gross amount', 400, 'INVALID_DISCOUNT');
  }

  // Validate installment total
  const installmentTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
  if (Math.abs(installmentTotal - netPayable) > 0.01) {
    throw new AppError(
      `Sum of installments (${installmentTotal}) must equal net payable amount (${netPayable})`,
      400,
      'INSTALLMENT_SUM_MISMATCH'
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Deactivate / handle previous fee structure if any
    const existingFee = await StudentFeeStructure.findOne({ studentId }).session(session);
    if (existingFee) {
      await FeeInstallment.deleteMany({ studentFeeStructureId: existingFee._id }).session(session);
      await StudentFeeStructure.findByIdAndDelete(existingFee._id).session(session);
    }

    const feeStructureArr = await StudentFeeStructure.create(
      [
        {
          studentId,
          courseId: courseId || student.courseId,
          batchId: batchId || student.batchId,
          grossAmount,
          discount: {
            amount: discountAmount,
            reason: discount?.reason || '',
            approvedBy: userId,
          },
          netPayable,
          totalPaid: 0,
          totalPending: netPayable,
          status: 'UNPAID',
          installmentsCount: installments.length,
        },
      ],
      { session }
    );

    const feeStructure = feeStructureArr[0];

    const installmentDocs = installments.map((inst, index) => ({
      studentFeeStructureId: feeStructure._id,
      studentId,
      installmentNumber: inst.installmentNumber || index + 1,
      title: inst.title || `Installment ${index + 1}`,
      amount: inst.amount,
      paidAmount: 0,
      pendingAmount: inst.amount,
      dueDate: new Date(inst.dueDate),
      status: 'PENDING',
    }));

    await FeeInstallment.insertMany(installmentDocs, { session });

    await session.commitTransaction();
    session.endSession();

    return getStudentFeeDetails(studentId);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getStudentFeeDetails = async (studentId) => {
  const feeStructure = await StudentFeeStructure.findOne({ studentId })
    .populate('studentId', 'personal contact studentCode studentType')
    .populate('courseId', 'name code fee')
    .populate('batchId', 'name');

  if (!feeStructure) {
    return null;
  }

  const installments = await FeeInstallment.find({
    studentFeeStructureId: feeStructure._id,
  }).sort({ installmentNumber: 1 });

  const payments = await FeePayment.find({
    studentFeeStructureId: feeStructure._id,
  })
    .populate('receivedBy', 'name email')
    .sort({ paymentDate: -1 });

  return {
    feeStructure,
    installments,
    payments,
  };
};

export const recordManualPayment = async (data, userId) => {
  const {
    studentId,
    studentFeeStructureId,
    installmentId,
    amountPaid,
    paymentMode,
    transactionRefNo,
    paymentDate,
    remarks,
  } = data;

  const feeStructure = await StudentFeeStructure.findById(studentFeeStructureId);
  if (!feeStructure) {
    throw new AppError('Fee structure not found', 404, 'FEE_STRUCTURE_NOT_FOUND');
  }

  if (feeStructure.totalPending <= 0 || feeStructure.status === 'PAID_FULL') {
    throw new AppError('Fee is already fully paid for this student', 400, 'FEE_ALREADY_PAID');
  }

  if (amountPaid > feeStructure.totalPending) {
    throw new AppError(
      `Payment amount (${amountPaid}) exceeds total pending fee (${feeStructure.totalPending})`,
      400,
      'EXCESS_PAYMENT'
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const paymentDocs = await FeePayment.create(
      [
        {
          receiptNumber,
          studentId,
          studentFeeStructureId,
          installmentId: installmentId || null,
          amountPaid,
          paymentMode,
          transactionRefNo,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          receivedBy: userId,
          remarks,
        },
      ],
      { session }
    );

    const payment = paymentDocs[0];

    // Allocate payment amount across installments
    let remainingPayment = amountPaid;
    let targetInstallments = [];

    if (installmentId) {
      const specificInst = await FeeInstallment.findById(installmentId).session(session);
      if (specificInst) targetInstallments.push(specificInst);
    }

    // Also fetch all unpaid installments ordered by installmentNumber
    const allPendingInsts = await FeeInstallment.find({
      studentFeeStructureId,
      status: { $ne: 'PAID' },
    })
      .sort({ installmentNumber: 1 })
      .session(session);

    for (const inst of allPendingInsts) {
      if (installmentId && inst._id.toString() === installmentId.toString()) continue;
      targetInstallments.push(inst);
    }

    for (const inst of targetInstallments) {
      if (remainingPayment <= 0) break;

      const dueInInst = inst.pendingAmount;
      const payToInst = Math.min(remainingPayment, dueInInst);

      inst.paidAmount += payToInst;
      inst.pendingAmount -= payToInst;
      remainingPayment -= payToInst;

      if (inst.pendingAmount === 0) {
        inst.status = 'PAID';
        inst.paidAt = new Date();
      } else {
        inst.status = 'PARTIALLY_PAID';
      }

      await inst.save({ session });
    }

    // Update overall fee structure
    feeStructure.totalPaid += amountPaid;
    feeStructure.totalPending = Math.max(0, feeStructure.netPayable - feeStructure.totalPaid);

    if (feeStructure.totalPending === 0) {
      feeStructure.status = 'PAID_FULL';
    } else {
      feeStructure.status = 'PARTIALLY_PAID';
    }

    await feeStructure.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      payment,
      updatedFeeStructure: feeStructure,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getDashboardSummary = async () => {
  const result = await StudentFeeStructure.aggregate([
    {
      $group: {
        _id: null,
        totalGross: { $sum: '$grossAmount' },
        totalDiscount: { $sum: '$discount.amount' },
        totalNetPayable: { $sum: '$netPayable' },
        totalPaid: { $sum: '$totalPaid' },
        totalPending: { $sum: '$totalPending' },
      },
    },
  ]);

  const overdueCount = await FeeInstallment.countDocuments({
    status: 'OVERDUE',
  });

  const metrics = result[0] || {
    totalGross: 0,
    totalDiscount: 0,
    totalNetPayable: 0,
    totalPaid: 0,
    totalPending: 0,
  };

  return {
    ...metrics,
    overdueInstallmentsCount: overdueCount,
  };
};

export const listStudentFees = async (query) => {
  const { page = 1, limit = 20, status, search } = query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  let studentIds = null;
  if (search) {
    const matchingStudents = await Student.find({
      $or: [
        { 'personal.firstName': { $regex: search, $options: 'i' } },
        { 'personal.lastName': { $regex: search, $options: 'i' } },
        { studentCode: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
      ],
    }).select('_id');

    studentIds = matchingStudents.map((s) => s._id);
    filter.studentId = { $in: studentIds };
  }

  const [data, total] = await Promise.all([
    StudentFeeStructure.find(filter)
      .populate('studentId', 'personal contact studentCode studentType')
      .populate('courseId', 'name code fee')
      .populate('batchId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StudentFeeStructure.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
