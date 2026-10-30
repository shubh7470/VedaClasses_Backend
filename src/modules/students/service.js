import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/AppError.js';
import { ROLES } from '../../common/constants/roles.js';
import { hashPassword } from '../../common/utils/password.js';

/**
 * Generate sequential student code: STD-YYYY-0001
 */
const generateStudentCode = async () => {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;

  const lastStudent = await prisma.student.findFirst({
    where: {
      studentCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      studentCode: 'desc',
    },
    select: {
      studentCode: true,
    },
  });

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
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      throw new AppError('User with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    if (cleanPhone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: cleanPhone } });
      if (existingPhone) {
        throw new AppError('User with this phone already exists.', 409, 'PHONE_EXISTS');
      }
    }

    const studentRole = await prisma.role.findUnique({ where: { name: ROLES.STUDENT } });
    if (!studentRole) {
      throw new AppError('System role STUDENT is not configured.', 500, 'ROLE_MISSING');
    }

    // Auto-generate code & password
    const studentCode = data.studentCode || (await generateStudentCode());
    const tempPassword = password || 'Student@123';
    const passwordHash = await hashPassword(tempPassword);

    const fullName = `${personal.firstName} ${personal.lastName || ''}`.trim();

    const { user, student } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: fullName,
          email: cleanEmail,
          phone: cleanPhone,
          passwordHash,
          studentType: 'REGULAR',
          status: 'ACTIVE',
          roles: {
            connect: [{ id: studentRole.id }],
          },
        },
      });

      const newStudent = await tx.student.create({
        data: {
          userId: newUser.id,
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
        },
        include: {
          user: true,
        },
      });

      return { user: newUser, student: newStudent };
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

    const where = {};

    if (queryParams.status) {
      where.status = queryParams.status;
    }

    if (queryParams.studentType) {
      where.studentType = queryParams.studentType;
    }

    if (queryParams.search) {
      const search = queryParams.search.trim();
      where.OR = [
        { studentCode: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
              profileImage: true,
              lastLoginAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    // Format output with userId populated as expected by frontend
    const formattedStudents = students.map((s) => ({
      ...s,
      userId: s.user ? { ...s.user, _id: s.user.id } : null,
    }));

    return {
      data: formattedStudents,
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
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            profileImage: true,
            lastLoginAt: true,
            authProvider: true,
            studentType: true,
          },
        },
        lead: {
          select: {
            id: true,
            source: true,
            status: true,
            convertedToAdmission: true,
            createdAt: true,
          },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    return {
      ...student,
      userId: student.user ? { ...student.user, _id: student.user.id } : null,
      leadId: student.lead ? { ...student.lead, _id: student.lead.id } : null,
    };
  },

  /**
   * Update student details
   */
  updateStudent: async (id, updateData) => {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    const currentPersonal = (student.personal && typeof student.personal === 'object') ? student.personal : {};
    const currentContact = (student.contact && typeof student.contact === 'object') ? student.contact : {};
    const currentGuardian = (student.guardian && typeof student.guardian === 'object') ? student.guardian : {};
    const currentAcademic = (student.academic && typeof student.academic === 'object') ? student.academic : {};

    const updatedPersonal = updateData.personal ? { ...currentPersonal, ...updateData.personal } : currentPersonal;
    const updatedContact = updateData.contact ? { ...currentContact, ...updateData.contact } : currentContact;
    const updatedGuardian = updateData.guardian ? { ...currentGuardian, ...updateData.guardian } : currentGuardian;
    const updatedAcademic = updateData.academic ? { ...currentAcademic, ...updateData.academic } : currentAcademic;

    // Sync to user table
    const userUpdates = {};
    if (updateData.personal?.firstName || updateData.personal?.lastName) {
      userUpdates.name = `${updatedPersonal.firstName || ''} ${updatedPersonal.lastName || ''}`.trim();
    }
    if (updateData.contact?.phone) {
      userUpdates.phone = updateData.contact.phone;
    }
    if (updateData.status) {
      userUpdates.status = updateData.status;
    }

    const updatedStudent = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({
          where: { id: student.userId },
          data: userUpdates,
        });
      }

      return tx.student.update({
        where: { id },
        data: {
          personal: updatedPersonal,
          contact: updatedContact,
          guardian: updatedGuardian,
          academic: updatedAcademic,
          ...(updateData.status && { status: updateData.status }),
        },
        include: {
          user: true,
        },
      });
    });

    return {
      ...updatedStudent,
      userId: updatedStudent.user ? { ...updatedStudent.user, _id: updatedStudent.user.id } : null,
    };
  },

  /**
   * Upgrade an ONLINE_GUEST student to a full REGULAR student
   */
  upgradeGuestToRegular: async (id, data = {}) => {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new AppError('Student not found.', 404, 'STUDENT_NOT_FOUND');
    }

    if (student.studentType === 'REGULAR') {
      throw new AppError('Student is already enrolled as a regular student.', 400, 'ALREADY_REGULAR');
    }

    const studentCode = data.studentCode || (await generateStudentCode());

    const currentGuardian = (student.guardian && typeof student.guardian === 'object') ? student.guardian : {};
    const currentAcademic = (student.academic && typeof student.academic === 'object') ? student.academic : {};

    const updatedGuardian = data.guardian ? { ...currentGuardian, ...data.guardian } : currentGuardian;
    const updatedAcademic = data.academic ? { ...currentAcademic, ...data.academic } : currentAcademic;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.userId },
        data: { studentType: 'REGULAR' },
      });

      if (student.leadId) {
        await tx.lead.update({
          where: { id: student.leadId },
          data: {
            status: 'CONVERTED',
            convertedToAdmission: true,
          },
        }).catch(() => {});
      }

      return tx.student.update({
        where: { id },
        data: {
          studentType: 'REGULAR',
          isEnrolled: true,
          studentCode,
          guardian: updatedGuardian,
          academic: updatedAcademic,
        },
      });
    });

    return updated;
  },

  /**
   * Student Self-Service: Get own profile details
   */
  getSelfProfile: async (userId) => {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            profileImage: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    return {
      ...student,
      userId: student.user ? { ...student.user, _id: student.user.id } : null,
    };
  },

  /**
   * Student Self-Service: Get fees (ENROLLED REGULAR STUDENTS ONLY)
   */
  getSelfFees: async (userId) => {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    if (!student.isEnrolled || student.studentType !== 'REGULAR') {
      throw new AppError(
        'Fee records are only available for enrolled coaching students.',
        403,
        'ENROLLMENT_REQUIRED'
      );
    }

    const feeStructures = await prisma.studentFeeStructure.findMany({
      where: { studentId: student.id },
      include: {
        installments: true,
        payments: true,
      },
    });

    const pendingAmount = feeStructures.reduce((sum, f) => sum + f.totalPending, 0);

    return {
      studentId: student.id,
      studentCode: student.studentCode,
      invoices: feeStructures,
      payments: feeStructures.flatMap((f) => f.payments),
      pendingAmount,
    };
  },

  /**
   * Student Self-Service: Get attendance (ENROLLED REGULAR STUDENTS ONLY)
   */
  getSelfAttendance: async (userId) => {
    const student = await prisma.student.findUnique({ where: { userId } });
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
      studentId: student.id,
      studentCode: student.studentCode,
      records: [],
      attendancePercentage: 0,
    };
  },

  /**
   * Student Self-Service: Get tests (AVAILABLE TO BOTH REGULAR & GUEST STUDENTS)
   */
  getSelfTests: async (userId) => {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new AppError('Student profile not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const availableSets = await prisma.mcqSet.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        subject: true,
        topicName: true,
        accessType: true,
        price: true,
        difficulty: true,
        durationMinutes: true,
        totalQuestionsCount: true,
      },
    });

    const recentAttempts = await prisma.mcqAttempt.findMany({
      where: { studentId: student.id },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    return {
      studentType: student.studentType,
      availableTests: availableSets,
      recentAttempts,
    };
  },
};
