import { z } from 'zod';

export const createStudentSchema = {
  body: z.object({
    personal: z.object({
      firstName: z.string({ required_error: 'First name is required' }).min(1),
      lastName: z.string().optional().default(''),
      dob: z.string().optional().nullable(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().default('OTHER'),
    }),
    contact: z.object({
      email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
      phone: z.string({ required_error: 'Phone number is required' }).min(10, 'Phone must be at least 10 digits'),
      address: z
        .object({
          line1: z.string().optional().default(''),
          city: z.string().optional().default(''),
          state: z.string().optional().default(''),
          pincode: z.string().optional().default(''),
        })
        .optional(),
    }),
    guardian: z
      .object({
        name: z.string().optional().default(''),
        phone: z.string().optional().default(''),
        relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional().default('FATHER'),
      })
      .optional(),
    academic: z
      .object({
        schoolName: z.string().optional().default(''),
        class: z.string().optional().default(''),
        board: z.string().optional().default(''),
      })
      .optional(),
    studentCode: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  }),
};

export const updateStudentSchema = {
  body: z.object({
    personal: z
      .object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().optional(),
        dob: z.string().optional().nullable(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      })
      .optional(),
    contact: z
      .object({
        phone: z.string().optional(),
        address: z
          .object({
            line1: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            pincode: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    guardian: z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
      })
      .optional(),
    academic: z
      .object({
        schoolName: z.string().optional(),
        class: z.string().optional(),
        board: z.string().optional(),
      })
      .optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  }),
};

export const upgradeStudentSchema = {
  body: z.object({
    studentCode: z.string().optional(),
    guardian: z
      .object({
        name: z.string().min(1, 'Guardian name is required'),
        phone: z.string().min(10, 'Guardian phone is required'),
        relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional().default('FATHER'),
      })
      .optional(),
    academic: z
      .object({
        schoolName: z.string().optional(),
        class: z.string().min(1, 'Class/Standard is required'),
        board: z.string().optional(),
      })
      .optional(),
  }),
};

export const listStudentsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    studentType: z.enum(['REGULAR', 'ONLINE_GUEST']).optional(),
  }),
};
