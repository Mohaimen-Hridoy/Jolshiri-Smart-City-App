const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { noticeCreateSchema, officeCreateSchema } = require('../utils/validation.part3');

/// Part 9: Notices & Offices. Notices are official admin announcements;
/// Offices are the fixed directory of on-site management/army/utility
/// offices shown in the Flutter app's "Contacts" screen.

// ── Notices ───────────────────────────────────────────────────────────────

/// GET /api/notices?category=
const listNotices = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const where = category ? { category: { contains: category, mode: 'insensitive' } } : {};
  const notices = await prisma.notice.findMany({ where, orderBy: { publishDate: 'desc' } });
  res.json({ notices });
});

/// GET /api/notices/:id
const getNotice = asyncHandler(async (req, res) => {
  const notice = await prisma.notice.findUnique({ where: { id: req.params.id } });
  if (!notice) throw new ApiError(404, 'Notice not found');
  res.json({ notice });
});

/// POST /api/notices — admin only
const createNotice = asyncHandler(async (req, res) => {
  const parsed = noticeCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const notice = await prisma.notice.create({
    data: { ...parsed.data, publishedById: req.user.id },
  });
  res.status(201).json({ notice });
});

/// PATCH /api/notices/:id
const updateNotice = asyncHandler(async (req, res) => {
  const existing = await prisma.notice.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Notice not found');

  const parsed = noticeCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const notice = await prisma.notice.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ notice });
});

/// DELETE /api/notices/:id
const deleteNotice = asyncHandler(async (req, res) => {
  const existing = await prisma.notice.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Notice not found');

  await prisma.notice.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// ── Offices ───────────────────────────────────────────────────────────────

/// GET /api/offices
const listOffices = asyncHandler(async (req, res) => {
  const offices = await prisma.office.findMany({ orderBy: { name: 'asc' } });
  res.json({ offices });
});

/// POST /api/offices — admin only
const createOffice = asyncHandler(async (req, res) => {
  const parsed = officeCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const office = await prisma.office.create({ data: parsed.data });
  res.status(201).json({ office });
});

/// PATCH /api/offices/:id
const updateOffice = asyncHandler(async (req, res) => {
  const existing = await prisma.office.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Office not found');

  const parsed = officeCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const office = await prisma.office.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ office });
});

/// DELETE /api/offices/:id
const deleteOffice = asyncHandler(async (req, res) => {
  const existing = await prisma.office.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Office not found');

  await prisma.office.delete({ where: { id: existing.id } });
  res.status(204).send();
});

module.exports = {
  listNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  listOffices,
  createOffice,
  updateOffice,
  deleteOffice,
};
