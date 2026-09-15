const express = require('express');
const {
  getKpis, listUsers, getUser, updateUser, deleteUser, listPlots,
  adminResetPassword, verifyUser,
} = require('../controllers/admin.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');

const requireAdmin = [authenticate, authorize('ADMIN')];
const requireSystemModerator = [...requireAdmin, authorizeAdminType('SYSTEM_MODERATOR')];

const router = express.Router();

router.get('/kpis', ...requireAdmin, getKpis);
router.get('/users', ...requireAdmin, listUsers);
router.get('/users/:id', ...requireAdmin, getUser);
// PATCH /users/:id — suspend, unsuspend, or ban a user.
// Any admin can suspend/unsuspend; SYSTEM_MODERATOR can also ban.
router.patch('/users/:id', ...requireAdmin, updateUser);
router.delete('/users/:id', ...requireSystemModerator, deleteUser);
// Any admin can trigger a password-reset email or manually verify a user —
// both are recovery actions, not destructive ones, so they don't require
// the SYSTEM_MODERATOR admin type.
router.post('/users/:id/reset-password', ...requireAdmin, adminResetPassword);
router.post('/users/:id/verify', ...requireAdmin, verifyUser);

// Plot archive — any admin can view; DEVELOPER role also allowed (for their dashboard)
router.get('/plots', authenticate, authorize('ADMIN', 'DEVELOPER'), listPlots);

module.exports = router;
