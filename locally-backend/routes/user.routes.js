const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

// GET /api/users/profile  - retrieve authenticated user profile
router.get('/profile', protect, getProfile);

// PUT /api/users/profile  - update authenticated user profile
router.put('/profile', protect, updateProfile);

module.exports = router;
