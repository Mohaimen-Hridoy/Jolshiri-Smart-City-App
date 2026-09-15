const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const {
  constructionProjectCreateSchema,
  stageCreateSchema,
  stageUpdateSchema,
  stageReviewSchema,
  permitStatusSchema,
} = require('../utils/validation.part3');

/// Part 6: Construction Lifecycle. A ConstructionProject has many
/// ConstructionStage rows. Role-based flow: the DEVELOPER submits a stage
/// (or an edit to one) as PENDING_APPROVAL; a JOLSHIRI_MANAGEMENT admin
/// then approves it (-> IN_PROGRESS or COMPLETED depending on progress) or
/// sends it back (-> DELAYED, with a note explaining why). The project's
/// building permit is approved separately by the same admin type.

async function loadProjectOr404(id) {
  const project = await prisma.constructionProject.findUnique({
    where: { id },
    include: { stages: { orderBy: { order: 'asc' } }, developer: true },
  });
  if (!project) throw new ApiError(404, 'Construction project not found');
  return project;
}

function assertDeveloperOwnsProject(project, user) {
  if (project.developer.userId !== user.id && user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only the assigned developer can do this');
  }
}

// ── Projects ──────────────────────────────────────────────────────────────

/// POST /api/construction/projects — the calling DEVELOPER starts a project
const createProject = asyncHandler(async (req, res) => {
  const parsed = constructionProjectCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
  if (!developer) throw new ApiError(404, 'No developer profile for this account');

  const resident = await prisma.user.findUnique({ where: { id: parsed.data.residentId } });
  if (!resident) throw new ApiError(404, 'Resident not found');

  const project = await prisma.constructionProject.create({
    data: { ...parsed.data, developerId: developer.id },
  });

  await notifyUser(
    resident.id,
    'Construction project started',
    `${developer.companyName} started tracking your project "${project.projectName}".`
  );

  res.status(201).json({ project });
});

/// GET /api/construction/projects/mine — resident or developer, scoped to their own; admin sees all
const listMyProjects = asyncHandler(async (req, res) => {
  let where = {};
  if (req.user.role === 'RESIDENT_OWNER') {
    where = { residentId: req.user.id };
  } else if (req.user.role === 'DEVELOPER') {
    const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
    if (!developer) throw new ApiError(404, 'No developer profile for this account');
    where = { developerId: developer.id };
  } // ADMIN falls through to {} — sees everything

  const projects = await prisma.constructionProject.findMany({
    where,
    include: { stages: { orderBy: { order: 'asc' } }, developer: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ projects });
});

/// GET /api/construction/projects/:id — only the resident who owns the
/// plot, the assigned developer, or an admin may view it (it carries the
/// resident's plot reference and permit/stage history).
const getProject = asyncHandler(async (req, res) => {
  const project = await loadProjectOr404(req.params.id);
  const isResident = project.residentId === req.user.id;
  const isDeveloper = project.developer.userId === req.user.id;
  if (!isResident && !isDeveloper && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have access to this construction project');
  }
  res.json({ project });
});

/// PATCH /api/construction/projects/:id/permit — JOLSHIRI_MANAGEMENT admin
/// approves or rejects the building permit (ConstructionPermitStatus).
const updatePermitStatus = asyncHandler(async (req, res) => {
  const project = await loadProjectOr404(req.params.id);

  const parsed = permitStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.constructionProject.update({
    where: { id: project.id },
    data: { permitStatus: parsed.data.status },
  });

  const verb = parsed.data.status === 'APPROVED' ? 'approved' : 'rejected';
  await notifyUser(
    project.residentId,
    `Permit ${verb}`,
    `The building permit for "${project.projectName}" has been ${verb}.`
  );
  await notifyUser(
    project.developer.userId,
    `Permit ${verb}`,
    `The building permit for "${project.projectName}" has been ${verb}.`
  );

  res.json({ project: updated });
});

// ── Stages ────────────────────────────────────────────────────────────────

/// POST /api/construction/projects/:id/stages — developer submits a new stage
const createStage = asyncHandler(async (req, res) => {
  const project = await loadProjectOr404(req.params.id);
  assertDeveloperOwnsProject(project, req.user);

  const parsed = stageCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const stage = await prisma.constructionStage.create({
    data: {
      ...parsed.data,
      projectId: project.id,
      order: parsed.data.order ?? project.stages.length,
      status: 'PENDING_APPROVAL',
    },
  });

  await notifyUser(
    project.residentId,
    'New construction stage submitted',
    `"${stage.title}" was submitted for "${project.projectName}" and is awaiting admin approval.`
  );

  res.status(201).json({ stage });
});

/// PATCH /api/construction/stages/:id — developer edits progress/description/eta,
/// then it goes back to PENDING_APPROVAL for admin review.
const updateStage = asyncHandler(async (req, res) => {
  const stage = await prisma.constructionStage.findUnique({
    where: { id: req.params.id },
    include: { project: { include: { developer: true } } },
  });
  if (!stage) throw new ApiError(404, 'Construction stage not found');
  assertDeveloperOwnsProject(stage.project, req.user);

  const parsed = stageUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.constructionStage.update({
    where: { id: stage.id },
    data: { ...parsed.data, status: 'PENDING_APPROVAL' },
  });

  res.json({ stage: updated });
});

/// PATCH /api/construction/stages/:id/review — JOLSHIRI_MANAGEMENT admin
/// approves (-> COMPLETED if progress is 100, else IN_PROGRESS) or sends
/// the stage back (-> DELAYED) with a note.
const reviewStage = asyncHandler(async (req, res) => {
  const stage = await prisma.constructionStage.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!stage) throw new ApiError(404, 'Construction stage not found');

  const parsed = stageReviewSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const nextStatus = parsed.data.approve ? (stage.progress >= 100 ? 'COMPLETED' : 'IN_PROGRESS') : 'DELAYED';

  const updated = await prisma.constructionStage.update({
    where: { id: stage.id },
    data: {
      status: nextStatus,
      // Shown on the resident's Build Track card as "Developer note: ...".
      ...(parsed.data.note !== undefined ? { developerNote: parsed.data.note } : {}),
    },
  });

  const message = parsed.data.approve
    ? `Stage "${stage.title}" was approved and is now ${nextStatus.toLowerCase().replace('_', ' ')}.`
    : `Stage "${stage.title}" was sent back: ${parsed.data.note || 'no reason given'}.`;

  await notifyUser(stage.project.residentId, 'Construction stage update', message);

  res.json({ stage: updated });
});

module.exports = {
  createProject,
  listMyProjects,
  getProject,
  updatePermitStatus,
  createStage,
  updateStage,
  reviewStage,
};
