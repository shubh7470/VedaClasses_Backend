import { z } from 'zod';

export const createCourseSchema = {
  body: z.object({
    name: z.string({ required_error: 'Course name is required' }).min(1),
    code: z.string({ required_error: 'Course code is required' }).min(2).max(20),
    description: z.string().optional().default(''),
    duration: z
      .object({
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
      })
      .optional(),
    subjects: z
      .array(
        z.object({
          name: z.string().min(1, 'Subject name is required'),
        })
      )
      .optional()
      .default([]),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  }),
};

export const updateCourseSchema = {
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(2).max(20).optional(),
    description: z.string().optional(),
    duration: z
      .object({
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
      })
      .optional(),
    subjects: z
      .array(
        z.object({
          name: z.string().min(1),
        })
      )
      .optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  }),
};

export const listCoursesSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  }),
};
