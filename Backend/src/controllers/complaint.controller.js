const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { fileUrlFor } = require('../middleware/upload');
const { notifyUser } = require('../services/notification.service');
const {
  complaintCreateSchema,
  complaintUpdateCreateSchema,
} = require('../utils/validation.part3');

/// Part 7: Complaint Register. A Complaint has a status/progress plus a
/// timeline of ComplaintUpdate rows — the resident's initial submission is
/// logged as the first entry, and every admin action appends another.

function assertOwnerOrAdmin(complaint, user) {
  if (complaint.residentId !== user.id && user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have access to this complaint');
  }
}

/// POST /api/complaints
const createComplaint = asyncHandler(async (req, res) => {
  const parsed = complaintCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: { ...parsed.data, residentId: req.user.id, imageUrl: fileUrlFor(req, req.file) },
    });
    await tx.complaintUpdate.create({
      data: {
        complaintId: created.id,
        authorId: null,
        note: 'Complaint submitted.',
        status: 'SUBMITTED',
      },
    });
    return created;
  });

  res.status(201).json({ complaint });
});

/// GET /api/complaints/mine
const listMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await prisma.complaint.findMany({
    where: { residentId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ complaints });
});

/// GET /api/complaints — admin, filterable by status/category
const listComplaints = asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const where = {};
  if (status) where.status = status;
  if (category) where.category = { contains: category, mode: 'insensitive' };

  const complaints = await prisma.complaint.findMany({
    where,
    include: { resident: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ complaints });
});

/// GET /api/complaints/:id
const getComplaint = asyncHandler(async (req, res) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  assertOwnerOrAdmin(complaint, req.user);
  res.json({ complaint });
});

/// GET /api/complaints/:id/updates — full timeline
const listComplaintUpdates = asyncHandler(async (req, res) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  assertOwnerOrAdmin(complaint, req.user);

  const updates = await prisma.complaintUpdate.findMany({
    where: { complaintId: complaint.id },
    include: { author: { select: { fullName: true } } },
    orderBy: { updatedAt: 'asc' },
  });
  res.json({ updates });
});

/// POST /api/complaints/:id/updates — admin appends a timeline entry and
/// updates the complaint's status/progress in one step.
const addComplaintUpdate = asyncHandler(async (req, res) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  const parsed = complaintUpdateCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const { update, updatedComplaint } = await prisma.$transaction(async (tx) => {
    const createdUpdate = await tx.complaintUpdate.create({
      data: {
        complaintId: complaint.id,
        authorId: req.user.id,
        note: parsed.data.note,
        status: parsed.data.status,
      },
    });
    const patchedComplaint = await tx.complaint.update({
      where: { id: complaint.id },
      data: {
        status: parsed.data.status,
        progress: parsed.data.progress ?? (parsed.data.status === 'RESOLVED' ? 100 : complaint.progress),
      },
    });
    return { update: createdUpdate, updatedComplaint: patchedComplaint };
  });

  await notifyUser(
    complaint.residentId,
    'Complaint update',
    `"${complaint.title}" is now ${parsed.data.status.toLowerCase().replace('_', ' ')}: ${parsed.data.note}`
  );

  res.status(201).json({ update, complaint: updatedComplaint });
});

module.exports = {
  createComplaint,
  listMyComplaints,
  listComplaints,
  getComplaint,
  listComplaintUpdates,
  addComplaintUpdate,
};
