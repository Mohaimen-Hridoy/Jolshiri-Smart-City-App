const express = require('express');
const {
  createMeeting,
  listMyMeetings,
  listDeveloperMeetings,
  updateMeetingStatus,
} = require('../controllers/meeting.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, authorize('RESIDENT_OWNER'), createMeeting);
router.get('/mine', authenticate, listMyMeetings);
router.get('/developer', authenticate, authorize('DEVELOPER'), listDeveloperMeetings);
router.patch('/:id/status', authenticate, authorize('DEVELOPER', 'ADMIN'), updateMeetingStatus);

module.exports = router;
