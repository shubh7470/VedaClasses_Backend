export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

export const PERMISSIONS = {
  // Students
  STUDENT_CREATE: 'student.create',
  STUDENT_READ: 'student.read',
  STUDENT_UPDATE: 'student.update',
  STUDENT_DELETE: 'student.delete',

  // Teachers
  TEACHER_CREATE: 'teacher.create',
  TEACHER_READ: 'teacher.read',
  TEACHER_UPDATE: 'teacher.update',
  TEACHER_DELETE: 'teacher.delete',

  // Courses & Batches
  COURSE_CREATE: 'course.create',
  COURSE_READ: 'course.read',
  COURSE_UPDATE: 'course.update',
  COURSE_DELETE: 'course.delete',

  BATCH_CREATE: 'batch.create',
  BATCH_READ: 'batch.read',
  BATCH_UPDATE: 'batch.update',
  BATCH_DELETE: 'batch.delete',

  // Attendance
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_UPDATE: 'attendance.update',

  // Fees & Payments
  FEE_CREATE: 'fees.create',
  FEE_READ: 'fees.read',
  FEE_UPDATE: 'fees.update',
  PAYMENT_READ: 'payment.read',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_REFUND: 'payment.refund',

  // Exams & Questions
  EXAM_CREATE: 'exam.create',
  EXAM_READ: 'exam.read',
  EXAM_UPDATE: 'exam.update',
  EXAM_PUBLISH: 'exam.publish',
  QUESTION_CREATE: 'question.create',
  QUESTION_READ: 'question.read',

  // Competitions
  COMPETITION_CREATE: 'competition.create',
  COMPETITION_READ: 'competition.read',
  COMPETITION_UPDATE: 'competition.update',

  // Announcements & Notifications
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_READ: 'announcement.read',
  NOTIFICATION_SEND: 'notification.send',

  // Payroll
  PAYROLL_GENERATE: 'payroll.generate',
  PAYROLL_READ: 'payroll.read',
  PAYROLL_PAY: 'payroll.pay',

  // Reports & Logs
  REPORT_READ: 'report.read',
  AUDIT_READ: 'audit.read',
};

export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.TEACHER]: [
    PERMISSIONS.STUDENT_READ,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.EXAM_CREATE,
    PERMISSIONS.EXAM_READ,
    PERMISSIONS.EXAM_UPDATE,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.ANNOUNCEMENT_READ,
  ],
  [ROLES.STUDENT]: [
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.ANNOUNCEMENT_READ,
  ],
};
