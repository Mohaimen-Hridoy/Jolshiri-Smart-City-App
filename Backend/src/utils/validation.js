const { z } = require('zod');

const ROLES = ['RESIDENT_OWNER', 'SERVICE_PROVIDER', 'DEVELOPER', 'ADMIN'];
// Roles the PUBLIC /api/auth/signup endpoint may create. ADMIN is
// deliberately excluded: ADMIN accounts (JOLSHIRI_MANAGEMENT,
// ARMY_OVERSIGHT, SYSTEM_MODERATOR) hold authority/security privileges
// (Security Reports, Complaint register, Authority Portal, user deletion,
// permit approval, ...) and must never be self-service — they are
// provisioned out-of-band (e.g. prisma/seed.js or a trusted admin using a
// dedicated internal tool), never via public signup or Google Sign-In.
const PUBLIC_SIGNUP_ROLES = ['RESIDENT_OWNER', 'SERVICE_PROVIDER', 'DEVELOPER'];
const ADMIN_TYPES = ['JOLSHIRI_MANAGEMENT', 'ARMY_OVERSIGHT', 'SYSTEM_MODERATOR'];
const CONSTRUCTION_STATUSES = ['NOT_STARTED', 'UNDER_CONSTRUCTION', 'COMPLETED'];
const RENT_STATUSES = ['OWNER_OCCUPIED', 'RENTING_OUT', 'NOT_RENTING'];

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is too short'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    phone: z.string().trim().min(6, 'Invalid phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(PUBLIC_SIGNUP_ROLES, {
      errorMap: () => ({ message: 'Admin accounts cannot be created through signup' }),
    }),
    address: z.string().trim().optional(),
    // Required only when role === DEVELOPER / SERVICE_PROVIDER — validated
    // in the controller since Zod's cross-field refine reads cleaner there
    // alongside the Prisma writes it feeds.
    companyName: z.string().trim().optional(),
    specialty: z.string().trim().optional(),
    serviceType: z.string().trim().optional(),
    // Plot ownership info — collected on the signup screen only when
    // role === RESIDENT_OWNER (PlotOwnershipInfo in app_models.dart).
    plotNumber: z.string().trim().optional(),
    sectorNumber: z.number().int().min(1).max(18).optional(),
    constructionStatus: z.enum(CONSTRUCTION_STATUSES).optional(),
    rentStatus: z.enum(RENT_STATUSES).optional(),
  })
  .refine((data) => data.role !== 'DEVELOPER' || (!!data.companyName && !!data.specialty), {
    message: 'companyName and specialty are required when role is DEVELOPER',
    path: ['companyName'],
  })
  .refine((data) => data.role !== 'SERVICE_PROVIDER' || !!data.serviceType, {
    message: 'serviceType is required when role is SERVICE_PROVIDER',
    path: ['serviceType'],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  signupSchema,
  loginSchema,
  ROLES,
  PUBLIC_SIGNUP_ROLES,
  ADMIN_TYPES,
  CONSTRUCTION_STATUSES,
  RENT_STATUSES,
};
