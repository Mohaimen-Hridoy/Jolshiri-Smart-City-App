const express = require('express');
const { query } = require('../controllers/chatbot.controller');

const router = express.Router();

// Public endpoint — no auth required so unauthenticated users can still
// ask basic questions on the login/home screen.
router.post('/query', query);

module.exports = router;
