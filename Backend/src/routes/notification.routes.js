const express = require('express');
const { listMyNotifications, markRead, markAllRead } = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/mine', authenticate, listMyNotifications);
// /read-all must be registered BEFORE /:id/read so Express does not
// interpret the literal string "read-all" as a notification id.
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

module.exports = router;
