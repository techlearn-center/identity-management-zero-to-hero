/**
 * RBAC Middleware - Check permissions from JWT claims.
 * Auth0 adds permissions to the access token when RBAC is enabled.
 */
function checkPermission(...requiredPermissions) {
  return (req, res, next) => {
    const tokenPermissions = req.auth?.permissions || [];
    const hasPermission = requiredPermissions.every(p => tokenPermissions.includes(p));

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        granted: tokenPermissions,
      });
    }
    next();
  };
}

module.exports = { checkPermission };
