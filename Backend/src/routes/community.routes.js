const express = require('express');
const {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  addComment,
} = require('../controllers/community.controller');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/', listPosts);
router.get('/:id', getPost);
router.post('/', authenticate, upload.single('image'), createPost);
router.patch('/:id', authenticate, upload.single('image'), updatePost);
router.delete('/:id', authenticate, deletePost);
router.post('/:id/comments', authenticate, addComment);

module.exports = router;
