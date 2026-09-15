const { z } = require('zod');

// ── Part 2: Property ─────────────────────────────────────────────────────────

const REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'];

const rentalCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  location: z.string().trim().min(1, 'location is required'),
  rentAmount: z.string().trim().min(1, 'rentAmount is required'),
  availability: z.string().trim().min(1, 'availability is required'),
  description: z.string().trim().min(1, 'description is required'),
  bedrooms: z.number().int().nonnegative(),
});

const rentalUpdateSchema = rentalCreateSchema.partial();

const viewingRequestCreateSchema = z.object({
  requesterName: z.string().trim().min(1, 'requesterName is required'),
  requesterPhone: z.string().trim().min(6, 'Invalid phone number'),
  note: z.string().trim().default(''),
});

const requestStatusUpdateSchema = z.object({
  status: z.enum(REQUEST_STATUSES.filter((s) => s !== 'PENDING')),
});

// In-app chat on a viewing request (requester <-> listing owner).
const messageCreateSchema = z.object({
  content: z.string().trim().min(1, 'content is required').max(2000, 'Message is too long'),
});

// ── Part 3: Developer & Service Provider Directory ──────────────────────────

const developerUpdateSchema = z
  .object({
    companyName: z.string().trim().min(1),
    contact: z.string().trim().min(1),
    specialty: z.string().trim().min(1),
  })
  .partial();

const providerUpdateSchema = z
  .object({
    name: z.string().trim().min(1),
    serviceType: z.string().trim().min(1),
    phone: z.string().trim().min(6),
  })
  .partial();

const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().default(''),
});

// ── Part 4: Bookings & Quotes ────────────────────────────────────────────────

const bookingCreateSchema = z.object({
  providerId: z.string().uuid('Invalid providerId'),
  serviceType: z.string().trim().min(1, 'serviceType is required'),
  address: z.string().trim().min(1, 'address is required'),
  note: z.string().trim().default(''),
});

const quoteCreateSchema = z.object({
  developerId: z.string().uuid('Invalid developerId'),
  projectType: z.string().trim().min(1, 'projectType is required'),
  plotLocation: z.string().trim().min(1, 'plotLocation is required'),
  budget: z.string().trim().min(1, 'budget is required'),
  note: z.string().trim().default(''),
});

// ── Part 5: Developer Meetings ───────────────────────────────────────────────

const meetingCreateSchema = z
  .object({
    developerId: z.string().uuid('Invalid developerId'),
    subject: z.string().trim().min(1, 'subject is required'),
    plotReference: z.string().trim().min(1, 'plotReference is required'),
    mode: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'),
    platform: z.enum(['ZOOM', 'GOOGLE_MEET']).optional(),
    location: z.string().trim().optional(),
    scheduledFor: z.coerce.date({ errorMap: () => ({ message: 'Invalid scheduledFor date' }) }),
    note: z.string().trim().default(''),
  })
  .refine((data) => data.mode !== 'ONLINE' || !!data.platform, {
    message: 'platform is required when mode is ONLINE',
    path: ['platform'],
  })
  .refine((data) => data.mode !== 'OFFLINE' || !!data.location, {
    message: 'location is required when mode is OFFLINE',
    path: ['location'],
  });

const meetingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']),
  // The developer's own Zoom/Google Meet link, pasted in when confirming an
  // ONLINE meeting — see meeting.controller.js#updateMeetingStatus.
  meetingLink: z.string().trim().url('Enter a valid meeting link (starting with https://)').optional(),
});

module.exports = {
  REQUEST_STATUSES,
  rentalCreateSchema,
  rentalUpdateSchema,
  viewingRequestCreateSchema,
  requestStatusUpdateSchema,
  messageCreateSchema,
  developerUpdateSchema,
  providerUpdateSchema,
  reviewCreateSchema,
  bookingCreateSchema,
  quoteCreateSchema,
  meetingCreateSchema,
  meetingStatusSchema,
};
