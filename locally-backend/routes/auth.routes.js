const express = require('express');
const router = express.Router();
const { registerUser, loginUser, refreshToken, logoutUser, verifyOtp } = require('../controllers/auth.controller');

const { authLimiter } = require('../middleware/ratelimit.middleware');
const { registerValidationRules, loginValidationRules, validate } = require('../middleware/validation.middleware');

router.post('/register', authLimiter, registerValidationRules, validate, registerUser);
router.post('/login', authLimiter, loginValidationRules, validate, loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/verify-otp', verifyOtp);

module.exports = router;
