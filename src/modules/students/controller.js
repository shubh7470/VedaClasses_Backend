import { studentService } from './service.js';

export const createStudent = async (req, res, next) => {
  try {
    const result = await studentService.createStudent(req.body);
    return res.status(201).json({
      success: true,
      message: 'Student onboarded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listStudents = async (req, res, next) => {
  try {
    const result = await studentService.listStudents(req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.params.id);
    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req, res, next) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

export const upgradeStudent = async (req, res, next) => {
  try {
    const student = await studentService.upgradeGuestToRegular(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Guest student successfully upgraded to enrolled regular student',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// --- Student Self-Service Controllers (Uses req.user.id strictly) ---

export const getSelfProfile = async (req, res, next) => {
  try {
    const profile = await studentService.getSelfProfile(req.user.id);
    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getSelfFees = async (req, res, next) => {
  try {
    const fees = await studentService.getSelfFees(req.user.id);
    return res.status(200).json({
      success: true,
      data: fees,
    });
  } catch (error) {
    next(error);
  }
};

export const getSelfAttendance = async (req, res, next) => {
  try {
    const attendance = await studentService.getSelfAttendance(req.user.id);
    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    next(error);
  }
};

export const getSelfTests = async (req, res, next) => {
  try {
    const tests = await studentService.getSelfTests(req.user.id);
    return res.status(200).json({
      success: true,
      data: tests,
    });
  } catch (error) {
    next(error);
  }
};
