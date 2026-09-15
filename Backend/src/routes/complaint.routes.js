const express = require('express');
const {
  createComplaint,
  listMyComplaints,
  listComplaints,
  getComplaint,
  listComplaintUpdates,
  addComplaintUpdate,
} = require('../controllers/complaint.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();
const requireJolshiriManagement = [authenticate, authorize('ADMIN'), authorizeAdminType('JOLSHIRI_MANAGEMENT')];

router.post('/', authenticate, authorize('RESIDENT_OWNER'), upload.single('image'), createComplaint);
router.get('/mine', authenticate, listMyComplaints);
router.get('/', ...requireJolshiriManagement, listComplaints);
router.get('/:id', authenticate, getComplaint);
router.get('/:id/updates', authenticate, listComplaintUpdates);
router.post('/:id/updates', ...requireJolshiriManagement, addComplaintUpdate);

module.exports = router;
