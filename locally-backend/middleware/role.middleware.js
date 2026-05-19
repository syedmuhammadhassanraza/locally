const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user ? (req.user.getDataValue('role') || req.user.role) : null;
    
    if (!req.user || !roles.includes(userRole)) {
      return res.status(403).json({
        message: `Forbidden: Role '${userRole || 'Guest'}' is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { authorize };
