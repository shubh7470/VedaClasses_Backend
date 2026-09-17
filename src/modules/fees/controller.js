import * as feeService from './service.js';

export const createFeeStructure = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await feeService.createFeeStructure(req.body, userId);
    res.status(201).json({
      success: true,
      message: 'Student fee structure and installments created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentFeeDetails = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const result = await feeService.getStudentFeeDetails(studentId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No fee structure found for this student',
      });
    }
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await feeService.recordManualPayment(req.body, userId);
    res.status(200).json({
      success: true,
      message: 'Payment recorded and receipt generated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    const metrics = await feeService.getDashboardSummary();
    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const listStudentFees = async (req, res, next) => {
  try {
    const result = await feeService.listStudentFees(req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};
