const express = require('express');
const router = express.Router();
const { updateStatus, getProviderStats } = require('../controllers/provider.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);
router.use(authorize('provider'));
router.put('/status', updateStatus);
router.get('/stats', getProviderStats);

module.exports = router;
