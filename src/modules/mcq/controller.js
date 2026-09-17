import * as mcqService from './service.js';

export const createMcqSet = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const setDoc = await mcqService.createMcqSet(req.body, userId);
    res.status(201).json({
      success: true,
      message: 'MCQ Test Set created successfully',
      data: setDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const getMcqSetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await mcqService.getMcqSetById(id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const addQuestionToSet = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const userId = req.user?._id || req.user?.id;
    const question = await mcqService.addQuestionToSet(setId, req.body, userId);
    res.status(201).json({
      success: true,
      message: 'MCQ Question added to set successfully',
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const result = await mcqService.deleteQuestion(questionId);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMcqSet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await mcqService.deleteMcqSet(id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const listMcqSets = async (req, res, next) => {
  try {
    const result = await mcqService.listMcqSets(req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const submitMcqAttempt = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const result = await mcqService.submitMcqAttempt(setId, req.body);
    res.status(200).json({
      success: true,
      message: 'Test submitted and evaluated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getSetLeaderboard = async (req, res, next) => {
  try {
    const { setId } = req.params;
    const results = await mcqService.getSetLeaderboard(setId);
    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};
