const express = require('express');
const {
  listDevelopers,
  getDeveloper,
  getMyDeveloperProfile,
  updateMyDeveloperProfile,
  updateDeveloper,
  verifyDeveloper,
  listProviders,
  getProvider,
  getMyProviderProfile,
  updateMyProviderProfile,
  updateProvider,
  verifyProvider,
  addReview,
  listReviews,
} = require('../controllers/directory.controller');
const { authenticate, authorize } = require('../middleware/auth');

const developerRouter = express.Router();
developerRouter.get('/', listDevelopers);
// NOTE: '/me' routes must be registered before '/:id' — otherwise Express
// matches the literal path "me" against the ':id' param and these never run.
developerRouter.get('/me', authenticate, authorize('DEVELOPER'), getMyDeveloperProfile);
developerRouter.patch('/me', authenticate, authorize('DEVELOPER'), updateMyDeveloperProfile);
developerRouter.get('/:id', getDeveloper);
developerRouter.patch('/:id', authenticate, authorize('DEVELOPER', 'ADMIN'), updateDeveloper);
developerRouter.patch('/:id/verify', authenticate, authorize('ADMIN'), verifyDeveloper);

const providerRouter = express.Router();
providerRouter.get('/', listProviders);
// Same ordering requirement as developerRouter above.
providerRouter.get('/me', authenticate, authorize('SERVICE_PROVIDER'), getMyProviderProfile);
providerRouter.patch('/me', authenticate, authorize('SERVICE_PROVIDER'), updateMyProviderProfile);
providerRouter.get('/:id', getProvider);
providerRouter.patch('/:id', authenticate, authorize('SERVICE_PROVIDER', 'ADMIN'), updateProvider);
providerRouter.patch('/:id/verify', authenticate, authorize('ADMIN'), verifyProvider);
providerRouter.post('/:id/reviews', authenticate, authorize('RESIDENT_OWNER'), addReview);
providerRouter.get('/:id/reviews', listReviews);

module.exports = { developerRouter, providerRouter };
