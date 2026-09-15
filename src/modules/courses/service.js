import { Course } from './model.js';
import { AppError } from '../../common/errors/AppError.js';

export const courseService = {
  /**
   * Create a new Course
   */
  createCourse: async (data) => {
    const cleanCode = data.code.toUpperCase().trim();
    const existing = await Course.findOne({ code: cleanCode });
    if (existing) {
      throw new AppError(`Course with code '${cleanCode}' already exists.`, 409, 'COURSE_CODE_EXISTS');
    }

    const course = await Course.create({
      ...data,
      code: cleanCode,
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

    const filter = {};

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.search) {
      const searchRegex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Course.countDocuments(filter),
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
    const course = await Course.findById(id);
    if (!course) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }
    return course;
  },

  /**
   * Update course details
   */
  updateCourse: async (id, updateData) => {
    if (updateData.code) {
      const cleanCode = updateData.code.toUpperCase().trim();
      const duplicate = await Course.findOne({ code: cleanCode, _id: { $ne: id } });
      if (duplicate) {
        throw new AppError(`Course with code '${cleanCode}' already exists.`, 409, 'COURSE_CODE_EXISTS');
      }
      updateData.code = cleanCode;
    }

    const course = await Course.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!course) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }

    return course;
  },

  /**
   * Delete course
   */
  deleteCourse: async (id) => {
    const course = await Course.findByIdAndDelete(id);
    if (!course) {
      throw new AppError('Course not found.', 404, 'COURSE_NOT_FOUND');
    }
    return true;
  },
};
