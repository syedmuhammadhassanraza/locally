const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadProfilePicture } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

// GET /api/users/profile  - retrieve authenticated user profile
router.get('/profile', protect, getProfile);

// PUT /api/users/profile  - update authenticated user profile
router.put('/profile', protect, updateProfile);

// POST /api/users/profile-picture - upload profile photo for validation
router.post('/profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);

module.exports = router;
