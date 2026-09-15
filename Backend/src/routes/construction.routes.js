const express = require('express');
const {
  createProject,
  listMyProjects,
  getProject,
  updatePermitStatus,
  createStage,
  updateStage,
  reviewStage,
} = require('../controllers/construction.controller');
const {
  createSoilTest,
  listMySoilTests,
  listSoilTests,
  updateSoilTestStatus,
} = require('../controllers/soilTest.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');

const requireJolshiriManagement = [authenticate, authorize('ADMIN'), authorizeAdminType('JOLSHIRI_MANAGEMENT')];

const projectRouter = express.Router();
projectRouter.post('/', authenticate, authorize('DEVELOPER'), createProject);
projectRouter.get('/mine', authenticate, listMyProjects);
projectRouter.get('/:id', authenticate, getProject);
projectRouter.patch('/:id/permit', ...requireJolshiriManagement, updatePermitStatus);
projectRouter.post('/:id/stages', authenticate, authorize('DEVELOPER'), createStage);

const stageRouter = express.Router();
stageRouter.patch('/:id', authenticate, authorize('DEVELOPER'), updateStage);
stageRouter.patch('/:id/review', ...requireJolshiriManagement, reviewStage);

// Soil test applications — resident submits (Build Track), Jolshiri
// Management reviews (Permits tab). Same "Part 6" area as the routers
// above, so it's registered under /api/construction/soil-tests in index.js.
const soilTestRouter = express.Router();
soilTestRouter.post('/', authenticate, authorize('RESIDENT_OWNER'), createSoilTest);
soilTestRouter.get('/mine', authenticate, listMySoilTests);
soilTestRouter.get('/', ...requireJolshiriManagement, listSoilTests);
soilTestRouter.patch('/:id/status', ...requireJolshiriManagement, updateSoilTestStatus);

module.exports = { projectRouter, stageRouter, soilTestRouter };
