const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { fileUrlFor } = require('../middleware/upload');
const {
  communityPostCreateSchema,
  communityPostUpdateSchema,
  postCommentCreateSchema,
} = require('../utils/validation.part3');

/// Part 9: Community Posts — buy/sell, lost & found, and event posts from
/// residents, shown in the Flutter app's community feed.

function assertAuthorOrAdmin(post, user) {
  if (post.authorId !== user.id && user.role !== 'ADMIN') {
    throw new ApiError(403, 'You can only edit your own post');
  }
}

const postInclude = {
  author: { select: { fullName: true } },
  comments: { include: { author: { select: { fullName: true } } }, orderBy: { postedAt: 'asc' } },
};

/// GET /api/community-posts?category=
const listPosts = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const where = category ? { category } : {};
  const posts = await prisma.communityPost.findMany({
    where,
    include: postInclude,
    orderBy: { postedAt: 'desc' },
  });
  res.json({ posts });
});

/// GET /api/community-posts/:id
const getPost = asyncHandler(async (req, res) => {
  const post = await prisma.communityPost.findUnique({
    where: { id: req.params.id },
    include: postInclude,
  });
  if (!post) throw new ApiError(404, 'Post not found');
  res.json({ post });
});

/// POST /api/community-posts — optional `image` file field, matching the
/// photo picker on the Flutter compose sheet (CommunityPost.imageBytes).
const createPost = asyncHandler(async (req, res) => {
  const parsed = communityPostCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const post = await prisma.communityPost.create({
    data: { ...parsed.data, authorId: req.user.id, imageUrl: fileUrlFor(req, req.file) },
    include: postInclude,
  });
  res.status(201).json({ post });
});

/// PATCH /api/community-posts/:id
const updatePost = asyncHandler(async (req, res) => {
  const existing = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Post not found');
  assertAuthorOrAdmin(existing, req.user);

  const parsed = communityPostUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const post = await prisma.communityPost.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(req.file ? { imageUrl: fileUrlFor(req, req.file) } : {}) },
    include: postInclude,
  });
  res.json({ post });
});

/// POST /api/community-posts/:id/comments
const addComment = asyncHandler(async (req, res) => {
  const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!post) throw new ApiError(404, 'Post not found');

  const parsed = postCommentCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const comment = await prisma.postComment.create({
    data: { postId: post.id, authorId: req.user.id, text: parsed.data.text },
    include: { author: { select: { fullName: true } } },
  });
  res.status(201).json({ comment });
});

/// DELETE /api/community-posts/:id
const deletePost = asyncHandler(async (req, res) => {
  const existing = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Post not found');
  assertAuthorOrAdmin(existing, req.user);

  await prisma.communityPost.delete({ where: { id: existing.id } });
  res.status(204).send();
});

module.exports = { listPosts, getPost, createPost, updatePost, deletePost, addComment };
