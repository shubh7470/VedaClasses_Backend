import { z } from 'zod';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const createBatchSchema = {
  body: z.object({
    courseId: z.string({ required_error: 'Course ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid course ID format'),
    name: z.string({ required_error: 'Batch name is required' }).min(1),
    batchCode: z.string({ required_error: 'Batch code is required' }).min(2).max(25),
    teachers: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid teacher ID')).optional().default([]),
    schedule: z
      .array(
        z.object({
          day: z.enum(DAYS, { required_error: 'Day is required' }),
          startTime: z.string({ required_error: 'Start time is required' }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM (e.g. 08:00)'),
          endTime: z.string({ required_error: 'End time is required' }).regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM (e.g. 09:30)'),
        })
      )
      .optional()
      .default([]),
    capacity: z.number().int().positive().optional().default(50),
    status: z.enum(['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED']).optional().default('ACTIVE'),
  }),
};

export const updateBatchSchema = {
  body: z.object({
    courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    name: z.string().min(1).optional(),
    batchCode: z.string().min(2).max(25).optional(),
    teachers: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    schedule: z
      .array(
        z.object({
          day: z.enum(DAYS),
          startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        })
      )
      .optional(),
    capacity: z.number().int().positive().optional(),
    status: z.enum(['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED']).optional(),
  }),
};

export const listBatchesSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    teacherId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED']).optional(),
  }),
};
