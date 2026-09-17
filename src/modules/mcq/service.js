import { McqSet, McqQuestion, McqAttempt } from './model.js';
import { AppError } from '../../common/errors/AppError.js';

export const createMcqSet = async (data, userId) => {
  const {
    title,
    subject,
    topicName,
    accessType,
    price,
    difficulty,
    marksPerQuestion,
    negativeMarks,
    durationMinutes,
    passingMarks,
  } = data;

  const finalPrice = accessType === 'PAID' ? Math.max(0, Number(price) || 0) : 0;

  const setDoc = await McqSet.create({
    title,
    subject: subject || 'General',
    topicName: topicName || '',
    accessType: accessType || 'FREE',
    price: finalPrice,
    difficulty: difficulty || 'MEDIUM',
    marksPerQuestion: Number(marksPerQuestion) || 4,
    negativeMarks: Number(negativeMarks) || 1,
    durationMinutes: Number(durationMinutes) || 30,
    passingMarks: Number(passingMarks) || 0,
    createdBy: userId,
  });

  return setDoc;
};

export const getMcqSetById = async (setId) => {
  const setDoc = await McqSet.findById(setId).populate('createdBy', 'name email');
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const questions = await McqQuestion.find({ setId }).sort({ questionNumber: 1 });

  return {
    set: setDoc,
    questions,
  };
};

export const addQuestionToSet = async (setId, data, userId) => {
  const setDoc = await McqSet.findById(setId);
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const currentCount = await McqQuestion.countDocuments({ setId });

  const questionDoc = await McqQuestion.create({
    setId,
    questionNumber: currentCount + 1,
    question: data.question,
    imageUrl: data.imageUrl || '',
    options: data.options,
    correctOption: data.correctOption,
    explanation: data.explanation || '',
    explanationImage: data.explanationImage || '',
    createdBy: userId,
  });

  setDoc.totalQuestionsCount += 1;
  await setDoc.save();

  return questionDoc;
};

export const deleteQuestion = async (questionId) => {
  const question = await McqQuestion.findById(questionId);
  if (!question) {
    throw new AppError('Question not found.', 404, 'QUESTION_NOT_FOUND');
  }

  const setId = question.setId;
  await McqQuestion.findByIdAndDelete(questionId);

  const remainingCount = await McqQuestion.countDocuments({ setId });
  await McqSet.findByIdAndUpdate(setId, { totalQuestionsCount: remainingCount });

  return { message: 'Question deleted successfully' };
};

export const deleteMcqSet = async (setId) => {
  const setDoc = await McqSet.findById(setId);
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  await McqQuestion.deleteMany({ setId });
  await McqAttempt.deleteMany({ setId });
  await McqSet.findByIdAndDelete(setId);

  return { message: 'MCQ Test Set and all questions deleted successfully' };
};

export const listMcqSets = async (query) => {
  const { page = 1, limit = 20, subject, accessType, difficulty, search } = query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (subject && subject !== 'all') {
    filter.subject = subject;
  }
  if (accessType && accessType !== 'all') {
    filter.accessType = accessType;
  }
  if (difficulty && difficulty !== 'all') {
    filter.difficulty = difficulty;
  }
  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: searchRegex }, { topicName: searchRegex }];
  }

  const [sets, total] = await Promise.all([
    McqSet.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    McqSet.countDocuments(filter),
  ]);

  return {
    data: sets,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const submitMcqAttempt = async (setId, data) => {
  const { studentId, answers = [] } = data;

  const setDoc = await McqSet.findById(setId);
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const questions = await McqQuestion.find({ setId });
  const questionMap = new Map();
  questions.forEach((q) => questionMap.set(q._id.toString(), q));

  let score = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unanswered = 0;

  const evaluatedAnswers = answers.map((ans) => {
    const q = questionMap.get(ans.questionId);
    if (!q) {
      return { questionId: ans.questionId, selectedOption: 'UNANSWERED', isCorrect: false, marksObtained: 0 };
    }

    if (!ans.selectedOption || ans.selectedOption === 'UNANSWERED') {
      unanswered++;
      return { questionId: ans.questionId, selectedOption: 'UNANSWERED', isCorrect: false, marksObtained: 0 };
    }

    const isCorrect = ans.selectedOption === q.correctOption;
    if (isCorrect) {
      correctAnswers++;
      const marks = setDoc.marksPerQuestion;
      score += marks;
      return { questionId: ans.questionId, selectedOption: ans.selectedOption, isCorrect: true, marksObtained: marks };
    } else {
      wrongAnswers++;
      const negMarks = setDoc.negativeMarks;
      score -= negMarks;
      return { questionId: ans.questionId, selectedOption: ans.selectedOption, isCorrect: false, marksObtained: -negMarks };
    }
  });

  const totalMarks = questions.length * setDoc.marksPerQuestion;

  const attemptDoc = await McqAttempt.create({
    setId,
    studentId,
    startedAt: new Date(Date.now() - setDoc.durationMinutes * 60000),
    submittedAt: new Date(),
    status: 'SUBMITTED',
    score,
    totalMarks,
    correctAnswers,
    wrongAnswers,
    unanswered,
    answers: evaluatedAnswers,
  });

  return attemptDoc;
};

export const getSetLeaderboard = async (setId) => {
  const attempts = await McqAttempt.find({ setId })
    .populate('studentId', 'personal contact studentCode')
    .sort({ score: -1, submittedAt: 1 })
    .limit(50);

  return attempts;
};
