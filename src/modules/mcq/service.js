import { prisma } from '../../config/database.js';
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

  const setDoc = await prisma.mcqSet.create({
    data: {
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
      createdBy: userId || null,
    },
  });

  return setDoc;
};

export const getMcqSetById = async (setId) => {
  const setDoc = await prisma.mcqSet.findUnique({
    where: { id: setId },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const questions = await prisma.mcqQuestion.findMany({
    where: { setId },
    orderBy: { questionNumber: 'asc' },
  });

  return {
    set: {
      ...setDoc,
      createdBy: setDoc.creator ? { ...setDoc.creator, _id: setDoc.creator.id } : setDoc.createdBy,
    },
    questions,
  };
};

export const addQuestionToSet = async (setId, data, userId) => {
  const setDoc = await prisma.mcqSet.findUnique({ where: { id: setId } });
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const currentCount = await prisma.mcqQuestion.count({ where: { setId } });

  const questionDoc = await prisma.$transaction(async (tx) => {
    const question = await tx.mcqQuestion.create({
      data: {
        setId,
        questionNumber: currentCount + 1,
        question: data.question,
        imageUrl: data.imageUrl || '',
        options: data.options,
        correctOption: data.correctOption,
        explanation: data.explanation || '',
        explanationImage: data.explanationImage || '',
        createdBy: userId || null,
      },
    });

    await tx.mcqSet.update({
      where: { id: setId },
      data: { totalQuestionsCount: currentCount + 1 },
    });

    return question;
  });

  return questionDoc;
};

export const deleteQuestion = async (questionId) => {
  const question = await prisma.mcqQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    throw new AppError('Question not found.', 404, 'QUESTION_NOT_FOUND');
  }

  const setId = question.setId;

  await prisma.$transaction(async (tx) => {
    await tx.mcqQuestion.delete({ where: { id: questionId } });
    const remainingCount = await tx.mcqQuestion.count({ where: { setId } });
    await tx.mcqSet.update({
      where: { id: setId },
      data: { totalQuestionsCount: remainingCount },
    });
  });

  return { message: 'Question deleted successfully' };
};

export const deleteMcqSet = async (setId) => {
  const setDoc = await prisma.mcqSet.findUnique({ where: { id: setId } });
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  await prisma.mcqSet.delete({ where: { id: setId } });

  return { message: 'MCQ Test Set and all questions deleted successfully' };
};

export const listMcqSets = async (query) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const where = {};
  if (query.subject && query.subject !== 'all') {
    where.subject = query.subject;
  }
  if (query.accessType && query.accessType !== 'all') {
    where.accessType = query.accessType;
  }
  if (query.difficulty && query.difficulty !== 'all') {
    where.difficulty = query.difficulty;
  }
  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { topicName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [sets, total] = await Promise.all([
    prisma.mcqSet.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.mcqSet.count({ where }),
  ]);

  const formattedSets = sets.map((s) => ({
    ...s,
    createdBy: s.creator ? { ...s.creator, _id: s.creator.id } : s.createdBy,
  }));

  return {
    data: formattedSets,
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

  const setDoc = await prisma.mcqSet.findUnique({ where: { id: setId } });
  if (!setDoc) {
    throw new AppError('MCQ Test Set not found.', 404, 'SET_NOT_FOUND');
  }

  const questions = await prisma.mcqQuestion.findMany({ where: { setId } });
  const questionMap = new Map();
  questions.forEach((q) => questionMap.set(q.id, q));

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

  const attemptDoc = await prisma.mcqAttempt.create({
    data: {
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
    },
  });

  return attemptDoc;
};

export const getSetLeaderboard = async (setId) => {
  const attempts = await prisma.mcqAttempt.findMany({
    where: { setId },
    include: {
      student: {
        select: { id: true, personal: true, contact: true, studentCode: true },
      },
    },
    orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
    take: 50,
  });

  return attempts.map((att) => ({
    ...att,
    studentId: att.student ? { ...att.student, _id: att.student.id } : att.studentId,
  }));
};
