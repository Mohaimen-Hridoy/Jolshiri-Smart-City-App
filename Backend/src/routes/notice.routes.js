const express = require('express');
const {
  listNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  listOffices,
  createOffice,
  updateOffice,
  deleteOffice,
} = require('../controllers/notice.controller');
const { authenticate, authorize } = require('../middleware/auth');

const noticeRouter = express.Router();
noticeRouter.get('/', listNotices);
noticeRouter.get('/:id', getNotice);
noticeRouter.post('/', authenticate, authorize('ADMIN'), createNotice);
noticeRouter.patch('/:id', authenticate, authorize('ADMIN'), updateNotice);
noticeRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteNotice);

const officeRouter = express.Router();
officeRouter.get('/', listOffices);
officeRouter.post('/', authenticate, authorize('ADMIN'), createOffice);
officeRouter.patch('/:id', authenticate, authorize('ADMIN'), updateOffice);
officeRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteOffice);

module.exports = { noticeRouter, officeRouter };
