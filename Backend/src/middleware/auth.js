const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/db');

/// Verifies the `Authorization: Bearer <token>` header and attaches the
/// authenticated user to `req.user`. Every protected route in every part
/// (2 through 9) sits behind this.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Missing or malformed Authorization header');
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new ApiError(401, 'User no longer exists');
    }

    // Bug 2 Fix: a user whose account was suspended or banned after they
    // logged in can still hold a valid JWT. Re-check accountStatus on
    // every authenticated request so revocation takes effect immediately
    // without waiting for the token to expire.
    if (user.accountStatus === 'SUSPENDED') {
      throw new ApiError(403, 'Your account has been suspended.');
    }
    if (user.accountStatus === 'BANNED') {
      throw new ApiError(403, 'Your account has been permanently banned.');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(err);
  }
}

/// Restricts a route to one or more UserRole values, e.g.
/// `authorize('DEVELOPER')` or `authorize('ADMIN', 'DEVELOPER')`.
/// Call after `authenticate` so `req.user` is already populated.
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}

/// Restricts an ADMIN-role route to one or more AdminType values, e.g.
/// `authorizeAdminType('JOLSHIRI_MANAGEMENT')` for the Construction/
/// Complaints endpoints. Call after `authorize('ADMIN')`.
function authorizeAdminType(...allowedAdminTypes) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return next(new ApiError(403, 'Admin access required'));
    }
    if (!allowedAdminTypes.includes(req.user.adminType)) {
      return next(new ApiError(403, 'Your admin type does not have access to this resource'));
    }
    next();
  };
}

module.exports = { authenticate, authorize, authorizeAdminType };
