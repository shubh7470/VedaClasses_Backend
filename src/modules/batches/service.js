import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/AppError.js';

const formatBatch = (batch) => {
  if (!batch) return null;
  return {
    ...batch,
    courseId: batch.course ? { ...batch.course, _id: batch.course.id } : batch.courseId,
    teachers: (batch.teachers || []).map((t) => ({ ...t, _id: t.id })),
  };
};

export const batchService = {
  /**
   * Create a new Batch
   */
  createBatch: async (data) => {
    // 1. Verify that Course exists
    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) {
      throw new AppError('Associated course not found.', 404, 'COURSE_NOT_FOUND');
    }

    // 2. Check batchCode uniqueness
    const cleanCode = data.batchCode.toUpperCase().trim();
    const existing = await prisma.batch.findUnique({ where: { batchCode: cleanCode } });
    if (existing) {
      throw new AppError(`Batch with code '${cleanCode}' already exists.`, 409, 'BATCH_CODE_EXISTS');
    }

    const batch = await prisma.batch.create({
      data: {
        name: data.name,
        batchCode: cleanCode,
        courseId: data.courseId,
        capacity: Number(data.capacity) || 50,
        status: data.status || 'ACTIVE',
        schedule: data.schedule || [],
        ...(Array.isArray(data.teachers) && data.teachers.length > 0 && {
          teachers: {
            connect: data.teachers.map((id) => ({ id })),
          },
        }),
      },
      include: {
        course: {
          select: { id: true, name: true, code: true, description: true, subjects: true },
        },
        teachers: {
          select: { id: true, name: true, email: true, phone: true, profileImage: true },
        },
      },
    });

    return formatBatch(batch);
  },

  /**
   * List batches with filtering and pagination
   */
  listBatches: async (queryParams) => {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where = {};

    if (queryParams.courseId) {
      where.courseId = queryParams.courseId;
    }

    if (queryParams.teacherId) {
      where.teachers = {
        some: { id: queryParams.teacherId },
      };
    }

    if (queryParams.status) {
      where.status = queryParams.status;
    }

    if (queryParams.search) {
      const search = queryParams.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { batchCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: {
          course: {
            select: { id: true, name: true, code: true },
          },
          teachers: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.batch.count({ where }),
    ]);

    return {
      data: batches.map(formatBatch),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single batch by ID
   */
  getBatchById: async (id) => {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, name: true, code: true, description: true, subjects: true },
        },
        teachers: {
          select: { id: true, name: true, email: true, phone: true, profileImage: true },
        },
      },
    });

    if (!batch) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }

    return formatBatch(batch);
  },

  /**
   * Update batch details
   */
  updateBatch: async (id, updateData) => {
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }

    if (updateData.courseId) {
      const course = await prisma.course.findUnique({ where: { id: updateData.courseId } });
      if (!course) {
        throw new AppError('Associated course not found.', 404, 'COURSE_NOT_FOUND');
      }
    }

    if (updateData.batchCode) {
      const cleanCode = updateData.batchCode.toUpperCase().trim();
      const duplicate = await prisma.batch.findFirst({
        where: {
          batchCode: cleanCode,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new AppError(`Batch with code '${cleanCode}' already exists.`, 409, 'BATCH_CODE_EXISTS');
      }
      updateData.batchCode = cleanCode;
    }

    const dataToUpdate = {
      ...(updateData.name && { name: updateData.name }),
      ...(updateData.batchCode && { batchCode: updateData.batchCode }),
      ...(updateData.courseId && { courseId: updateData.courseId }),
      ...(updateData.capacity !== undefined && { capacity: Number(updateData.capacity) }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.schedule !== undefined && { schedule: updateData.schedule }),
    };

    if (Array.isArray(updateData.teachers)) {
      dataToUpdate.teachers = {
        set: updateData.teachers.map((tId) => ({ id: tId })),
      };
    }

    const batch = await prisma.batch.update({
      where: { id },
      data: dataToUpdate,
      include: {
        course: {
          select: { id: true, name: true, code: true },
        },
        teachers: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return formatBatch(batch);
  },

  /**
   * Delete batch
   */
  deleteBatch: async (id) => {
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }

    await prisma.batch.delete({ where: { id } });
    return true;
  },
};
