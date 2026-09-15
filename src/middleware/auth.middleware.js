import { verifyAccessToken } from '../common/utils/jwt.js';
import { AppError } from '../common/errors/AppError.js';
import { User } from '../modules/users/model.js';

export const authenticate = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(
        new AppError('Authentication required. Please login.', 401, 'UNAUTHORIZED')
      );
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(
          new AppError('Access token has expired. Please refresh.', 401, 'TOKEN_EXPIRED')
        );
      }
      return next(
        new AppError('Invalid access token.', 401, 'INVALID_TOKEN')
      );
    }

    const user = await User.findById(decoded.userId).populate('roleIds');
    if (!user) {
      return next(new AppError('User belonging to this token no longer exists.', 401, 'USER_NOT_FOUND'));
    }

    if (user.status !== 'ACTIVE') {
      return next(
        new AppError(`Account is ${user.status.toLowerCase()}. Please contact admin.`, 403, 'ACCOUNT_INACTIVE')
      );
    }

    // Aggregate roles and permissions
    const roles = user.roleIds.map((r) => r.name);
    const permissions = Array.from(
      new Set(user.roleIds.flatMap((r) => r.permissions || []))
    );

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles,
      permissions,
    };

    next();
  } catch (error) {
    next(error);
  }
};
