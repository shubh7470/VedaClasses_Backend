import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/AppError.js';

export const courseService = {
  /**
   * Create a new Course
   */
  createCourse: async (data) => {
    const cleanCode = data.code.toUpperCase().trim();
    const existing = await prisma.course.findUnique({ where: { code: cleanCode } });
    if (existing) {
      throw new AppError(`Course with code '${cleanCode}' already exists.`, 409, 'COURSE_CODE_EXISTS');
    }

    const course = await prisma.course.create({
      data: {
        name: data.name,
        code: cleanCode,
        description: data.description || '',
        duration: data.duration || {},
        subjects: data.subjects || [],
        fee: Number(data.fee) || 0,
        status: data.status || 'ACTIVE',
      },
    });

    return course;
  },

  /**
   * List courses with search and pagination
   */
  listCourses: async (queryParams) => {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where = {};

    if (queryParams.status) {
      where.status = queryParams.status;
    }

    if (queryParams.search) {
      const search = queryParams.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      data: courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single course by ID
   */
  getCourseById: async (id) => {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }
    return course;
  },

  /**
   * Update course details
   */
  updateCourse: async (id, updateData) => {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }

    if (updateData.code) {
      const cleanCode = updateData.code.toUpperCase().trim();
      const duplicate = await prisma.course.findFirst({
        where: {
          code: cleanCode,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new AppError(`Course with code '${cleanCode}' already exists.`, 409, 'COURSE_CODE_EXISTS');
      }
      updateData.code = cleanCode;
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.code && { code: updateData.code }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.duration !== undefined && { duration: updateData.duration }),
        ...(updateData.subjects !== undefined && { subjects: updateData.subjects }),
        ...(updateData.fee !== undefined && { fee: Number(updateData.fee) }),
        ...(updateData.status && { status: updateData.status }),
      },
    });

    return course;
  },

  /**
   * Delete course
   */
  deleteCourse: async (id) => {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }

    await prisma.course.delete({ where: { id } });
    return true;
  },
};
