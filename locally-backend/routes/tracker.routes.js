const express = require('express');
const router = express.Router();
const { getTrackingInfo } = require('../controllers/tracker.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/:bookingId', getTrackingInfo);

module.exports = router;
