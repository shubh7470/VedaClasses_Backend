import { Batch } from './model.js';
import { Course } from '../courses/model.js';
import { AppError } from '../../common/errors/AppError.js';

export const batchService = {
  /**
   * Create a new Batch
   */
  createBatch: async (data) => {
    // 1. Verify that Course exists
    const course = await Course.findById(data.courseId);
    if (!course) {
      throw new AppError('Associated course not found.', 404, 'COURSE_NOT_FOUND');
    }

    // 2. Check batchCode uniqueness
    const cleanCode = data.batchCode.toUpperCase().trim();
    const existing = await Batch.findOne({ batchCode: cleanCode });
    if (existing) {
      throw new AppError(`Batch with code '${cleanCode}' already exists.`, 409, 'BATCH_CODE_EXISTS');
    }

    const batch = await Batch.create({
      ...data,
      batchCode: cleanCode,
    });

    return batch;
  },

  /**
   * List batches with filtering and pagination
   */
  listBatches: async (queryParams) => {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {};

    if (queryParams.courseId) {
      filter.courseId = queryParams.courseId;
    }

    if (queryParams.teacherId) {
      filter.teachers = queryParams.teacherId;
    }

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { batchCode: searchRegex }];
    }

    const [batches, total] = await Promise.all([
      Batch.find(filter)
        .populate('courseId', 'name code')
        .populate('teachers', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Batch.countDocuments(filter),
    ]);

    return {
      data: batches,
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
    const batch = await Batch.findById(id)
      .populate('courseId', 'name code description subjects')
      .populate('teachers', 'name email phone profileImage');

    if (!batch) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }

    return batch;
  },

  /**
   * Update batch details
   */
  updateBatch: async (id, updateData) => {
    if (updateData.courseId) {
      const course = await Course.findById(updateData.courseId);
      if (!course) {
        throw new AppError('Associated course not found.', 404, 'COURSE_NOT_FOUND');
      }
    }

    if (updateData.batchCode) {
      const cleanCode = updateData.batchCode.toUpperCase().trim();
      const duplicate = await Batch.findOne({ batchCode: cleanCode, _id: { $ne: id } });
      if (duplicate) {
        throw new AppError(`Batch with code '${cleanCode}' already exists.`, 409, 'BATCH_CODE_EXISTS');
      }
      updateData.batchCode = cleanCode;
    }

    const batch = await Batch.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('courseId', 'name code')
      .populate('teachers', 'name email phone');

    if (!batch) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }

    return batch;
  },

  /**
   * Delete batch
   */
  deleteBatch: async (id) => {
    const batch = await Batch.findByIdAndDelete(id);
    if (!batch) {
      throw new AppError('Batch not found.', 404, 'BATCH_NOT_FOUND');
    }
    return true;
  },
};
