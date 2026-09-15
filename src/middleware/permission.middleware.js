import { AppError } from '../common/errors/AppError.js';
import { ROLES } from '../common/constants/roles.js';

/**
 * Checks if the authenticated user has at least one of the allowed roles
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User authentication missing.', 401, 'UNAUTHORIZED'));
    }

    // ADMIN always bypasses role checks
    if (req.user.roles.includes(ROLES.ADMIN)) {
      return next();
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return next(
        new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN')
      );
    }

    next();
  };
};

/**
 * Checks if the authenticated user has a specific permission (module.action)
 */
export const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User authentication missing.', 401, 'UNAUTHORIZED'));
    }

    // ADMIN role possesses all permissions
    if (req.user.roles.includes(ROLES.ADMIN)) {
      return next();
    }

    const hasPermission = req.user.permissions.includes(requiredPermission);
    if (!hasPermission) {
      return next(
        new AppError(`Forbidden: Missing permission [${requiredPermission}]`, 403, 'INSUFFICIENT_PERMISSIONS')
      );
    }

    next();
  };
};
