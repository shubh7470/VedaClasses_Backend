import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/AppError.js';

const formatFeeStructure = (fee) => {
  if (!fee) return null;
  return {
    ...fee,
    studentId: fee.student ? { ...fee.student, _id: fee.student.id } : fee.studentId,
    courseId: fee.course ? { ...fee.course, _id: fee.course.id } : fee.courseId,
    batchId: fee.batch ? { ...fee.batch, _id: fee.batch.id } : fee.batchId,
  };
};

export const createFeeStructure = async (data, userId) => {
  const { studentId, courseId, batchId, grossAmount, discount, installments } = data;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
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

  await prisma.$transaction(async (tx) => {
    // Remove previous fee structure if any exists
    const existingFee = await tx.studentFeeStructure.findFirst({ where: { studentId } });
    if (existingFee) {
      await tx.feeInstallment.deleteMany({ where: { studentFeeStructureId: existingFee.id } });
      await tx.studentFeeStructure.delete({ where: { id: existingFee.id } });
    }

    const feeStructure = await tx.studentFeeStructure.create({
      data: {
        studentId,
        courseId: courseId || null,
        batchId: batchId || null,
        grossAmount: Number(grossAmount),
        discount: {
          amount: discountAmount,
          reason: discount?.reason || '',
          approvedBy: userId || null,
        },
        netPayable: Number(netPayable),
        totalPaid: 0,
        totalPending: Number(netPayable),
        status: 'UNPAID',
        installmentsCount: installments.length,
      },
    });

    const installmentData = installments.map((inst, index) => ({
      studentFeeStructureId: feeStructure.id,
      studentId,
      installmentNumber: inst.installmentNumber || index + 1,
      title: inst.title || `Installment ${index + 1}`,
      amount: Number(inst.amount),
      paidAmount: 0,
      pendingAmount: Number(inst.amount),
      dueDate: new Date(inst.dueDate),
      status: 'PENDING',
    }));

    await tx.feeInstallment.createMany({
      data: installmentData,
    });
  });

  return getStudentFeeDetails(studentId);
};

export const getStudentFeeDetails = async (studentId) => {
  const feeStructure = await prisma.studentFeeStructure.findFirst({
    where: { studentId },
    include: {
      student: {
        select: { id: true, personal: true, contact: true, studentCode: true, studentType: true },
      },
      course: {
        select: { id: true, name: true, code: true, fee: true },
      },
      batch: {
        select: { id: true, name: true },
      },
    },
  });

  if (!feeStructure) {
    return null;
  }

  const installments = await prisma.feeInstallment.findMany({
    where: { studentFeeStructureId: feeStructure.id },
    orderBy: { installmentNumber: 'asc' },
  });

  const payments = await prisma.feePayment.findMany({
    where: { studentFeeStructureId: feeStructure.id },
    include: {
      receiver: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });

  const formattedPayments = payments.map((p) => ({
    ...p,
    receivedBy: p.receiver ? { ...p.receiver, _id: p.receiver.id } : p.receivedBy,
  }));

  return {
    feeStructure: formatFeeStructure(feeStructure),
    installments: installments.map((inst) => ({ ...inst, _id: inst.id })),
    payments: formattedPayments,
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

  const feeStructure = await prisma.studentFeeStructure.findUnique({
    where: { id: studentFeeStructureId },
  });

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

  return await prisma.$transaction(async (tx) => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const payment = await tx.feePayment.create({
      data: {
        receiptNumber,
        studentId,
        studentFeeStructureId,
        installmentId: installmentId || null,
        amountPaid: Number(amountPaid),
        paymentMode,
        transactionRefNo: transactionRefNo || '',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        receivedBy: userId || null,
        remarks: remarks || '',
      },
    });

    let remainingPayment = Number(amountPaid);
    let targetInstallments = [];

    if (installmentId) {
      const specificInst = await tx.feeInstallment.findUnique({ where: { id: installmentId } });
      if (specificInst) targetInstallments.push(specificInst);
    }

    const allPendingInsts = await tx.feeInstallment.findMany({
      where: {
        studentFeeStructureId,
        status: { not: 'PAID' },
      },
      orderBy: { installmentNumber: 'asc' },
    });

    for (const inst of allPendingInsts) {
      if (installmentId && inst.id === installmentId) continue;
      targetInstallments.push(inst);
    }

    for (const inst of targetInstallments) {
      if (remainingPayment <= 0) break;

      const dueInInst = inst.pendingAmount;
      const payToInst = Math.min(remainingPayment, dueInInst);

      const newPaid = inst.paidAmount + payToInst;
      const newPending = inst.pendingAmount - payToInst;
      remainingPayment -= payToInst;

      const isPaid = newPending === 0;

      await tx.feeInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount: newPaid,
          pendingAmount: newPending,
          status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: isPaid ? new Date() : inst.paidAt,
        },
      });
    }

    const newTotalPaid = feeStructure.totalPaid + Number(amountPaid);
    const newTotalPending = Math.max(0, feeStructure.netPayable - newTotalPaid);
    const newStatus = newTotalPending === 0 ? 'PAID_FULL' : 'PARTIALLY_PAID';

    const updatedFeeStructure = await tx.studentFeeStructure.update({
      where: { id: feeStructure.id },
      data: {
        totalPaid: newTotalPaid,
        totalPending: newTotalPending,
        status: newStatus,
      },
    });

    return {
      payment: { ...payment, _id: payment.id },
      updatedFeeStructure: { ...updatedFeeStructure, _id: updatedFeeStructure.id },
    };
  });
};

export const getDashboardSummary = async () => {
  const aggregateResult = await prisma.studentFeeStructure.aggregate({
    _sum: {
      grossAmount: true,
      netPayable: true,
      totalPaid: true,
      totalPending: true,
    },
  });

  // Calculate total discounts
  const feeStructures = await prisma.studentFeeStructure.findMany({
    select: { discount: true },
  });

  const totalDiscount = feeStructures.reduce((sum, f) => {
    const d = f.discount;
    if (d && typeof d === 'object' && d.amount) {
      return sum + Number(d.amount);
    }
    return sum;
  }, 0);

  const overdueCount = await prisma.feeInstallment.count({
    where: { status: 'OVERDUE' },
  });

  return {
    totalGross: aggregateResult._sum.grossAmount || 0,
    totalDiscount,
    totalNetPayable: aggregateResult._sum.netPayable || 0,
    totalPaid: aggregateResult._sum.totalPaid || 0,
    totalPending: aggregateResult._sum.totalPending || 0,
    overdueInstallmentsCount: overdueCount,
  };
};

export const listStudentFees = async (query) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const where = {};
  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    const search = query.search.trim();
    where.student = {
      OR: [
        { studentCode: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  const [fees, total] = await Promise.all([
    prisma.studentFeeStructure.findMany({
      where,
      include: {
        student: {
          select: { id: true, personal: true, contact: true, studentCode: true, studentType: true },
        },
        course: {
          select: { id: true, name: true, code: true, fee: true },
        },
        batch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.studentFeeStructure.count({ where }),
  ]);

  return {
    data: fees.map(formatFeeStructure),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
