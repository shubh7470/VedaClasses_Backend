import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = err.errors || [];

  // Prisma unique constraint violation (P2002)
  if (err.code === 'P2002') {
    statusCode = 409;
    const target = err.meta?.target;
    const field = Array.isArray(target) ? target.join(', ') : target || 'field';
    message = `A record with this ${field} already exists.`;
    code = 'DUPLICATE_ENTRY';
    errors = [{ field, message }];
  }

  // Prisma record not found (P2025)
  if (err.code === 'P2025') {
    statusCode = 404;
    message = err.meta?.cause || 'Requested record was not found.';
    code = 'NOT_FOUND';
  }

  // Prisma foreign key constraint failed (P2003)
  if (err.code === 'P2003') {
    statusCode = 400;
    const field = err.meta?.field_name || 'relation';
    message = `Related record not found for: ${field}`;
    code = 'FOREIGN_KEY_VIOLATION';
  }

  // Send standard JSON error response
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors.length > 0 && { errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
