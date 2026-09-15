const express = require('express');
const { createReport, listReports, getReport, updateReportStatus, getHeatmap } = require('../controllers/security.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');

const router = express.Router();
const requireSecurityAdmin = [
  authenticate,
  authorize('ADMIN'),
  authorizeAdminType('JOLSHIRI_MANAGEMENT', 'ARMY_OVERSIGHT'),
];

router.post('/', authenticate, createReport);
// Scoped inside the controller: security admins see every report,
// residents only see their own (needed for the resident Security screen's
// "Recent activity" list, which calls this same endpoint).
router.get('/', authenticate, listReports);
// GET /heatmap — ARMY_OVERSIGHT / JOLSHIRI_MANAGEMENT only.
// Returns incidents grouped by block with counts + coordinates for the map.
// Must be registered BEFORE /:id so Express doesn't treat "heatmap" as an id.
router.get('/heatmap', ...requireSecurityAdmin, getHeatmap);
router.get('/:id', authenticate, getReport);
router.patch('/:id/status', ...requireSecurityAdmin, updateReportStatus);

module.exports = router;
