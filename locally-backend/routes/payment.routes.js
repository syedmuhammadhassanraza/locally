const express = require('express');
const router = express.Router();
const { processPayment } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', processPayment);

module.exports = router;
