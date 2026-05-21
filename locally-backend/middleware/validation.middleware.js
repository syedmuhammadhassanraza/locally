const { body, validationResult } = require('express-validator');

// Error handling middleware to capture validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: errors.array()[0].msg, // Return the first clean error message
      errors: errors.array() 
    });
  }
  next();
};

// Signup validation schema
const registerValidationRules = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.'),
  body('cnic')
    .optional({ checkFalsy: true })
    .matches(/^\d{13}$/).withMessage('CNIC must be exactly 13 digits (numbers only, no dashes).'),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
];

// Login validation schema
const loginValidationRules = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .optional({ checkFalsy: true })
];

module.exports = {
  validate,
  registerValidationRules,
  loginValidationRules
};
