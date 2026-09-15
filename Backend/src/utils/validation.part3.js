const { z } = require('zod');

// ── Part 6: Construction Lifecycle ───────────────────────────────────────────

const STAGE_STATUSES = ['COMPLETED', 'IN_PROGRESS', 'UPCOMING', 'DELAYED', 'PENDING_APPROVAL'];

const constructionProjectCreateSchema = z.object({
  projectName: z.string().trim().min(1, 'projectName is required'),
  plotReference: z.string().trim().min(1, 'plotReference is required'),
  residentId: z.string().uuid('Invalid residentId'),
  estimatedCompletion: z.string().trim().min(1, 'estimatedCompletion is required'),
});

const stageCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  eta: z.string().trim().min(1, 'eta is required'),
  order: z.number().int().nonnegative().optional(),
});

// Developer-side edit: progress/description/eta only — status changes go
// through the admin review endpoint below (submit -> approve/send-back).
const stageUpdateSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    progress: z.number().min(0).max(100),
    eta: z.string().trim().min(1),
    // The developer's free-text progress note shown to the resident on the
    // "Build Track" timeline (ConstructionStage.developerNote in schema.prisma).
    // Was missing here, so the frontend's PATCH /construction/stages/:id
    // body silently had this field stripped by zod and the resident never
    // actually saw the developer's note after a refresh.
    developerNote: z.string().trim(),
  })
  .partial();

const stageReviewSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().optional(),
});

// PENDING is the default set at project creation; admins only ever move it
// to APPROVED or REJECTED (ConstructionPermitStatus in app_models.dart).
const permitStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// ── Soil test applications (part of Part 6: Construction Lifecycle) ─────────

const SOIL_TEST_STATUSES = ['REQUESTED', 'PERMIT_GRANTED', 'PAYMENT_DONE', 'COMPLETED', 'REJECTED'];

const soilTestCreateSchema = z.object({
  plotReference: z.string().trim().min(1, 'plotReference is required'),
  projectName: z.string().trim().min(1, 'projectName is required'),
});

const soilTestStatusSchema = z.object({
  status: z.enum(SOIL_TEST_STATUSES),
  note: z.string().trim().optional(),
});

// ── Part 7: Complaint Register ───────────────────────────────────────────────

const COMPLAINT_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'];

const complaintCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  category: z.string().trim().min(1, 'category is required'),
  description: z.string().trim().min(1, 'description is required'),
  plotReference: z.string().trim().min(1, 'plotReference is required'),
});

const complaintUpdateCreateSchema = z.object({
  note: z.string().trim().min(1, 'note is required'),
  status: z.enum(COMPLAINT_STATUSES),
  progress: z.number().min(0).max(100).optional(),
});

// ── Part 8: Payments ──────────────────────────────────────────────────────────

const PAYMENT_PURPOSES = ['CONSULTATION_FEE', 'DEVELOPMENT_AGREEMENT', 'SOIL_TEST_FEE'];

const paymentCreateSchema = z.object({
  userId: z.string().uuid('Invalid userId'),
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().default(''),
  purpose: z.enum(PAYMENT_PURPOSES),
  amount: z.string().trim().min(1, 'amount is required'),
});

const paymentCallbackSchema = z.object({
  gatewayRef: z.string().trim().min(1),
  outcome: z.enum(['PAID', 'FAILED']),
});

// ── Part 9: Notices, Community & Notifications ───────────────────────────────

const noticeCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  category: z.string().trim().min(1, 'category is required'),
});

const officeCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  contact: z.string().trim().min(1, 'contact is required'),
  location: z.string().trim().min(1, 'location is required'),
});

const communityPostCreateSchema = z.object({
  content: z.string().trim().min(1, 'content is required'),
  category: z.string().trim().min(1, 'category is required'),
  price: z.string().trim().optional(),
});

const communityPostUpdateSchema = communityPostCreateSchema.partial();

const postCommentCreateSchema = z.object({
  text: z.string().trim().min(1, 'text is required'),
});

const appointmentCreateSchema = z.object({
  officeName: z.string().trim().min(1, 'officeName is required'),
  preferredDate: z.string().trim().min(1, 'preferredDate is required'),
  reason: z.string().trim().min(1, 'reason is required'),
});

const appointmentStatusSchema = z.object({
  status: z.enum(['Pending', 'Confirmed', 'Cancelled']),
});

const INCIDENT_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'];

const securityReportCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  // Severity is optional — defaults to MODERATE on the DB side so older
  // clients that don't send the field still work correctly.
  severity: z.enum(INCIDENT_SEVERITIES).optional(),
});

const securityReportStatusSchema = z.object({
  status: z.enum(['Open', 'In Progress', 'Resolved']),
});

module.exports = {
  INCIDENT_SEVERITIES,
  STAGE_STATUSES,
  constructionProjectCreateSchema,
  stageCreateSchema,
  stageUpdateSchema,
  stageReviewSchema,
  permitStatusSchema,
  SOIL_TEST_STATUSES,
  soilTestCreateSchema,
  soilTestStatusSchema,
  COMPLAINT_STATUSES,
  complaintCreateSchema,
  complaintUpdateCreateSchema,
  PAYMENT_PURPOSES,
  paymentCreateSchema,
  paymentCallbackSchema,
  noticeCreateSchema,
  officeCreateSchema,
  appointmentCreateSchema,
  appointmentStatusSchema,
  communityPostCreateSchema,
  communityPostUpdateSchema,
  postCommentCreateSchema,
  securityReportCreateSchema,
  securityReportStatusSchema,
};
