import { Router } from 'express';
import {
  createMcqSet,
  getMcqSetById,
  addQuestionToSet,
  deleteQuestion,
  deleteMcqSet,
  listMcqSets,
  submitMcqAttempt,
  getSetLeaderboard,
} from './controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { checkPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { PERMISSIONS } from '../../common/constants/roles.js';
import {
  createMcqSetSchema,
  addMcqQuestionSchema,
  listMcqSetsSchema,
  submitMcqAttemptSchema,
} from './validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/sets',
  checkPermission(PERMISSIONS.EXAM_CREATE),
  validateRequest(createMcqSetSchema),
  createMcqSet
);

router.get('/sets', validateRequest(listMcqSetsSchema), listMcqSets);

router.get('/sets/:id', getMcqSetById);

router.delete('/sets/:id', checkPermission(PERMISSIONS.EXAM_CREATE), deleteMcqSet);

router.post(
  '/sets/:setId/questions',
  checkPermission(PERMISSIONS.QUESTION_CREATE),
  validateRequest(addMcqQuestionSchema),
  addQuestionToSet
);

router.delete('/questions/:questionId', checkPermission(PERMISSIONS.QUESTION_CREATE), deleteQuestion);

router.post(
  '/sets/:setId/submit',
  validateRequest(submitMcqAttemptSchema),
  submitMcqAttempt
);

router.get('/sets/:setId/results', getSetLeaderboard);

export default router;
