import { z } from 'zod';

export const createMcqSetSchema = {
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).min(2),
    subject: z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General']).optional().default('General'),
    topicName: z.string().optional().default(''),
    accessType: z.enum(['FREE', 'PAID']).optional().default('FREE'),
    price: z.number().min(0).optional().default(0),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional().default('MEDIUM'),
    marksPerQuestion: z.number().min(1).optional().default(4),
    negativeMarks: z.number().min(0).optional().default(1),
    durationMinutes: z.number().min(1).optional().default(30),
    passingMarks: z.number().min(0).optional().default(0),
  }),
};

export const addMcqQuestionSchema = {
  body: z.object({
    question: z.string({ required_error: 'Question text is required' }).min(2),
    imageUrl: z.string().optional().default(''),
    options: z
      .array(
        z.object({
          id: z.enum(['A', 'B', 'C', 'D']),
          text: z.string().min(1, 'Option text cannot be empty'),
          image: z.string().optional().default(''),
        })
      )
      .min(2, 'At least 2 options are required'),
    correctOption: z.enum(['A', 'B', 'C', 'D'], { required_error: 'Correct option is required' }),
    explanation: z.string().optional().default(''),
    explanationImage: z.string().optional().default(''),
  }),
};

export const listMcqSetsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    subject: z.string().optional(),
    accessType: z.enum(['FREE', 'PAID']).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  }),
};

export const submitMcqAttemptSchema = {
  body: z.object({
    studentId: z.string({ required_error: 'Student ID is required' }),
    answers: z.array(
      z.object({
        questionId: z.string(),
        selectedOption: z.enum(['A', 'B', 'C', 'D', 'UNANSWERED']).default('UNANSWERED'),
      })
    ),
  }),
};
