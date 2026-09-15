const express = require('express');
const { unreadCount } = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');

// The per-viewing-request thread routes (GET/POST .../messages) live under
// /api/viewing-requests/:id/messages — see rental.routes.js. This router
// only holds the cross-thread badge count.
const router = express.Router();
router.get('/unread-count', authenticate, unreadCount);

module.exports = router;
