const express = require('express');
const router = express.Router();
const { handleChat, getChatHistory } = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

const { chatLimiter } = require('../middleware/rateLimit.middleware');

router.use(protect);
router.post('/', chatLimiter, handleChat);
router.get('/history', getChatHistory);

module.exports = router;
