const express = require('express');
const router = express.Router();
const { createBooking, getBookings, updateBookingStatus, reassignBooking, cancelBooking } = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', createBooking);
router.get('/', getBookings);
router.put('/:id/status', updateBookingStatus);
router.put('/:id/reassign', reassignBooking);
router.put('/:id/cancel', cancelBooking);

module.exports = router;
