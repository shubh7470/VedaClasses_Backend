import { z } from 'zod';

export const createFeeStructureSchema = {
  body: z.object({
    studentId: z.string({ required_error: 'Student ID is required' }),
    courseId: z.string().optional().nullable(),
    batchId: z.string().optional().nullable(),
    grossAmount: z.number({ required_error: 'Gross amount is required' }).min(0),
    discount: z
      .object({
        amount: z.number().min(0).optional().default(0),
        reason: z.string().optional().default(''),
      })
      .optional()
      .default({ amount: 0, reason: '' }),
    installments: z
      .array(
        z.object({
          installmentNumber: z.number().optional(),
          title: z.string({ required_error: 'Installment title is required' }),
          amount: z.number({ required_error: 'Installment amount is required' }).min(0),
          dueDate: z.string({ required_error: 'Due date is required' }),
        })
      )
      .min(1, 'At least 1 installment is required'),
  }),
};

export const recordPaymentSchema = {
  body: z.object({
    studentId: z.string({ required_error: 'Student ID is required' }),
    studentFeeStructureId: z.string({ required_error: 'Student Fee Structure ID is required' }),
    installmentId: z.string().optional().nullable(),
    amountPaid: z.number({ required_error: 'Amount paid is required' }).min(1),
    paymentMode: z.enum(['CASH', 'UPI_DIRECT', 'BANK_TRANSFER', 'CHEQUE', 'CARD_POS'], {
      required_error: 'Valid payment mode is required',
    }),
    transactionRefNo: z.string().optional().default(''),
    paymentDate: z.string().optional().nullable(),
    remarks: z.string().optional().default(''),
  }),
};

export const listStudentFeesSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID_FULL', 'OVERDUE']).optional(),
  }),
};
