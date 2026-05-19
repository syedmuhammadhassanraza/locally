const jwt = require('jsonwebtoken');
const { User, Provider } = require('../models');

const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_hackathon_2026');

      if (decoded.role === 'provider') {
        req.user = await Provider.findByPk(decoded.id);
        if (req.user) req.user.setDataValue('role', 'provider');
      } else {
        req.user = await User.findByPk(decoded.id);
        if (req.user) req.user.setDataValue('role', decoded.role || 'consumer');
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, entity not found' });
      }

      next();
    } catch (error) {
      console.error('Auth middleware token validation failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token validation failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no Bearer token provided' });
  }
};

module.exports = { protect };
