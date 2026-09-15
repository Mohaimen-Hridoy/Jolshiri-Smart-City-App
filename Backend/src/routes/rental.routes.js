const express = require('express');
const {
  listRentals,
  listMyRentals,
  getRental,
  createRental,
  updateRental,
  deleteRental,
  requestViewing,
  listViewingRequestsForListing,
  listAllViewingRequests,
  listMyViewingRequests,
  listViewingRequestsForMyListings,
  updateViewingRequestStatus,
} = require('../controllers/rental.controller');
const { listThread, sendMessage } = require('../controllers/message.controller');
const { authenticate, authorize, authorizeAdminType } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Standalone viewing-request routes (not nested under /:id) —
// mounted separately in index.js at /api/viewing-requests.
const viewingRequestRouter = express.Router();
// Fixed-segment routes (mine, for-my-listings, admin overview) must be
// registered BEFORE /:id/... so Express doesn't treat them as :id params.
viewingRequestRouter.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  authorizeAdminType('JOLSHIRI_MANAGEMENT'),
  listAllViewingRequests
);
viewingRequestRouter.get('/mine', authenticate, listMyViewingRequests);
// Requests for listings the calling RESIDENT_OWNER owns — the "flat view
// requests" owner inbox (approve/decline lives here).
viewingRequestRouter.get('/for-my-listings', authenticate, listViewingRequestsForMyListings);
viewingRequestRouter.patch('/:id/status', authenticate, updateViewingRequestStatus);
// In-app chat thread for one viewing request (requester <-> listing owner).
viewingRequestRouter.get('/:id/messages', authenticate, listThread);
viewingRequestRouter.post('/:id/messages', authenticate, sendMessage);

router.get('/', listRentals);
router.get('/mine', authenticate, listMyRentals);
router.get('/:id', getRental);
router.post('/', authenticate, authorize('RESIDENT_OWNER', 'ADMIN'), upload.single('image'), createRental);
router.patch('/:id', authenticate, upload.single('image'), updateRental);
router.delete('/:id', authenticate, deleteRental);

router.post('/:id/viewing-requests', authenticate, requestViewing);
router.get('/:id/viewing-requests', authenticate, listViewingRequestsForListing);

module.exports = { rentalRouter: router, viewingRequestRouter };
