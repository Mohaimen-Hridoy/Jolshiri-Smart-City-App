const express = require('express');
const {
  createAppointment,
  listMyAppointments,
  listAppointments,
  updateAppointmentStatus,
} = require('../controllers/appointment.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');

const router = express.Router();
const requireAuthorityAdmin = [authenticate, authorize('ADMIN'), authorizeAdminType('JOLSHIRI_MANAGEMENT')];

router.post('/', authenticate, createAppointment);
router.get('/mine', authenticate, listMyAppointments);
router.get('/', ...requireAuthorityAdmin, listAppointments);
router.patch('/:id/status', ...requireAuthorityAdmin, updateAppointmentStatus);

module.exports = router;
