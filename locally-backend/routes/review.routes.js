const express = require('express');
const router = express.Router();
const { submitReview } = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', submitReview);

module.exports = router;
