const express = require('express');
const router = express.Router();
const { handleChat, getChatHistory } = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', handleChat);
router.get('/history', getChatHistory);

module.exports = router;
