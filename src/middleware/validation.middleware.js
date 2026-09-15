import { AppError } from '../common/errors/AppError.js';

export const validateRequest = (schemas) => {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const validatedQuery = await schemas.query.parseAsync(req.query);
        // Express 5 query object is a getter; mutate properties instead of reassigning
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, validatedQuery);
      }
      if (schemas.params) {
        const validatedParams = await schemas.params.parseAsync(req.params);
        Object.assign(req.params, validatedParams);
      }
      next();
    } catch (error) {
      if (error.issues) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(
          new AppError('Validation failed', 400, 'VALIDATION_ERROR', formattedErrors)
        );
      }
      next(error);
    }
  };
};
