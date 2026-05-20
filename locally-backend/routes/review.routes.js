const express = require('express');
const router = express.Router();
const { createReview, getReviewsByProvider } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

// Protect creation, but allow viewing of reviews publicly
router.post('/', protect, createReview);
router.get('/provider/:providerId', getReviewsByProvider);

module.exports = router;
