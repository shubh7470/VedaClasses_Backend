import { Student } from './model.js';
import { User } from '../users/model.js';
import { Role } from '../roles/model.js';
import { Lead } from '../leads/model.js';
import { AppError } from '../../common/errors/AppError.js';
import { ROLES } from '../../common/constants/roles.js';
import { hashPassword } from '../../common/utils/password.js';

/**
 * Generate sequential student code: STD-YYYY-0001
 */
const generateStudentCode = async () => {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;

  const lastStudent = await Student.findOne({
    studentCode: new RegExp(`^${prefix}`),
  })
    .sort({ studentCode: -1 })
    .select('studentCode');

  let nextSequence = 1;
  if (lastStudent && lastStudent.studentCode) {
    const lastNumber = parseInt(lastStudent.studentCode.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextSequence = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
};

export const studentService = {
  /**
   * Admin onboards a new Regular Enrolled Student
   */
  createStudent: async (data) => {
    const { personal, contact, guardian, academic, password } = data;
    const cleanEmail = contact.email.toLowerCase().trim();
    const cleanPhone = contact.phone ? contact.phone.trim() : null;

    // Check unique email
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      throw new AppError('User with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    if (cleanPhone) {
      const existingPhone = await User.findOne({ phone: cleanPhone });
      if (existingPhone) {
        throw new AppError('User with this phone already exists.', 409, 'PHONE_EXISTS');
      }
    }

    const studentRole = await Role.findOne({ name: ROLES.STUDENT });
    if (!studentRole) {
      throw new AppError('System role STUDENT is not configured.', 500, 'ROLE_MISSING');
    }

    // Auto-generate code & password
    const studentCode = data.studentCode || (await generateStudentCode());
    const tempPassword = password || 'Student@123';
    const passwordHash = await hashPassword(tempPassword);

    const fullName = `${personal.firstName} ${personal.lastName || ''}`.trim();

    // 1. Create User account
    const user = await User.create({
      name: fullName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      roleIds: [studentRole._id],
      studentType: 'REGULAR',
      status: 'ACTIVE',
    });

    // 2. Create Student record
    const student = await Student.create({
      userId: user._id,
      studentType: 'REGULAR',
      isEnrolled: true,
      studentCode,
      personal,
      contact: {
        ...contact,
        email: cleanEmail,
        phone: cleanPhone,
      },
      guardian: guardian || {},
      academic: academic || {},
      status: 'ACTIVE',
    });

    return {
      student,
      initialCredentials: {
        email: cleanEmail,
        temporaryPassword: tempPassword,
      },
    };
  },

  /**
   * List students with filtering and pagination
   */
  listStudents: async (queryParams) => {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {};

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.studentType) {
      filter.studentType = queryParams.studentType;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { 'personal.firstName': searchRegex },
        { 'personal.lastName': searchRegex },
        { 'contact.email': searchRegex },
        { 'contact.phone': searchRegex },
        { studentCode: searchRegex },
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('userId', 'name email phone status profileImage lastLoginAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    return {
      data: students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single student by ID
   */
  getStudentById: async (id) => {
    const student = await Student.findById(id)
      .populate('userId', 'name email phone status profileImage lastLoginAt authProvider studentType')
      .populate('leadId', 'source status convertedToAdmission createdAt');

    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    return student;
  },

  /**
   * Update student details
   */
  updateStudent: async (id, updateData) => {
    const student = await Student.findById(id);
    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    // Update student fields
    if (updateData.personal) {
      student.personal = { ...student.personal.toObject(), ...updateData.personal };
    }
    if (updateData.contact) {
      student.contact = { ...student.contact.toObject(), ...updateData.contact };
    }
    if (updateData.guardian) {
      student.guardian = { ...student.guardian.toObject(), ...updateData.guardian };
    }
    if (updateData.academic) {
      student.academic = { ...student.academic.toObject(), ...updateData.academic };
    }
    if (updateData.status) {
      student.status = updateData.status;
    }

    await student.save();

    // Sync changes to User document
    const userUpdates = {};
    if (updateData.personal?.firstName || updateData.personal?.lastName) {
      userUpdates.name = `${student.personal.firstName} ${student.personal.lastName || ''}`.trim();
    }
    if (updateData.contact?.phone) {
      userUpdates.phone = updateData.contact.phone;
    }
    if (updateData.status) {
      userUpdates.status = updateData.status;
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(student.userId, userUpdates);
    }

    return student;
  },

  /**
   * Upgrade an ONLINE_GUEST student to a full REGULAR student
   */
  upgradeGuestToRegular: async (id, data = {}) => {
    const student = await Student.findById(id);
    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    if (student.studentType === 'REGULAR') {
      throw new AppError('Student is already enrolled as a regular student.', 400, 'ALREADY_REGULAR');
    }

    const studentCode = data.studentCode || (await generateStudentCode());

    student.studentType = 'REGULAR';
    student.isEnrolled = true;
    student.studentCode = studentCode;

    if (data.guardian) {
      student.guardian = { ...student.guardian.toObject(), ...data.guardian };
    }
    if (data.academic) {
      student.academic = { ...student.academic.toObject(), ...data.academic };
    }

    await student.save();

    // Update user record
    await User.findByIdAndUpdate(student.userId, { studentType: 'REGULAR' });

    // Update associated lead record if present
    if (student.leadId) {
      await Lead.findByIdAndUpdate(student.leadId, {
        status: 'CONVERTED',
        convertedToAdmission: true,
      });
    }

    return student;
  },

  /**
   * Student Self-Service: Get own profile details
   */
  getSelfProfile: async (userId) => {
    const student = await Student.findOne({ userId })
      .populate('userId', 'name email phone status profileImage lastLoginAt');

    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    return student;
  },

  /**
   * Student Self-Service: Get fees (ENROLLED REGULAR STUDENTS ONLY)
   */
  getSelfFees: async (userId) => {
    const student = await Student.findOne({ userId });
    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    // Strict Access Rule for Guest vs Regular Students
    if (!student.isEnrolled || student.studentType !== 'REGULAR') {
      throw new AppError(
        'Fee records are only available for enrolled coaching students.',
        403,
        'ENROLLMENT_REQUIRED'
      );
    }

    // Phase 2 will populate real invoices & payments from collections
    return {
      studentId: student._id,
      studentCode: student.studentCode,
      invoices: [],
      payments: [],
      pendingAmount: 0,
    };
  },

  /**
   * Student Self-Service: Get attendance (ENROLLED REGULAR STUDENTS ONLY)
   */
  getSelfAttendance: async (userId) => {
    const student = await Student.findOne({ userId });
    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    if (!student.isEnrolled || student.studentType !== 'REGULAR') {
      throw new AppError(
        'Attendance records are only available for enrolled coaching students.',
        403,
        'ENROLLMENT_REQUIRED'
      );
    }

    return {
      studentId: student._id,
      studentCode: student.studentCode,
      records: [],
      attendancePercentage: 0,
    };
  },

  /**
   * Student Self-Service: Get tests (AVAILABLE TO BOTH REGULAR & GUEST STUDENTS)
   */
  getSelfTests: async (userId) => {
    const student = await Student.findOne({ userId });
    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    // Available to both regular coaching students and online mock test takers
    return {
      studentType: student.studentType,
      availableTests: [],
      recentAttempts: [],
    };
  },
};
