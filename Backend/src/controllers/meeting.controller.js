const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const { meetingCreateSchema, meetingStatusSchema } = require('../utils/validation.part2');

/// Part 5: Developer Meetings — online (Zoom/Google Meet) or offline
/// (physical location), scheduled by a resident with a developer.
///
/// Meeting links are NOT auto-generated server-side. Creating a real Zoom/
/// Meet meeting on someone else's behalf needs that person's own Zoom/
/// Google account credentials (OAuth) — Jolshiri only has one app-level
/// service account, so any auto-generated link would be hosted under that
/// single account instead of the actual developer's, which isn't usable in
/// practice. Instead: the resident just picks a platform preference when
/// requesting an online meeting, and the developer pastes their own
/// Zoom/Google Meet link (created in their own Zoom/Meet account) when
/// they confirm the meeting — see updateMeetingStatus below.

/// POST /api/meetings
const createMeeting = asyncHandler(async (req, res) => {
  const parsed = meetingCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const data = parsed.data;

  const developer = await prisma.developer.findUnique({ where: { id: data.developerId } });
  if (!developer) throw new ApiError(404, 'Developer not found');

  const meeting = await prisma.developerMeeting.create({
    data: {
      developerId: data.developerId,
      residentId: req.user.id,
      subject: data.subject,
      plotReference: data.plotReference,
      mode: data.mode,
      platform: data.mode === 'ONLINE' ? data.platform : null,
      meetingLink: null, // set later by the developer when they confirm (ONLINE only)
      location: data.mode === 'OFFLINE' ? data.location : null,
      scheduledFor: data.scheduledFor,
      note: data.note,
    },
  });

  await notifyUser(
    developer.userId,
    'New meeting request',
    `${req.user.fullName} requested a meeting: "${data.subject}".`
  );

  res.status(201).json({ meeting });
});

/// GET /api/meetings/mine — resident's own scheduled meetings
const listMyMeetings = asyncHandler(async (req, res) => {
  const meetings = await prisma.developerMeeting.findMany({
    where: { residentId: req.user.id },
    include: { developer: true },
    orderBy: { scheduledFor: 'asc' },
  });
  res.json({ meetings });
});

/// GET /api/meetings/developer — the calling DEVELOPER's incoming meetings
const listDeveloperMeetings = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
  if (!developer) throw new ApiError(404, 'No developer profile for this account');

  const meetings = await prisma.developerMeeting.findMany({
    where: { developerId: developer.id },
    include: { resident: { select: { fullName: true, phone: true } } },
    orderBy: { scheduledFor: 'asc' },
  });
  res.json({ meetings });
});

/// PATCH /api/meetings/:id/status — the developer confirms/cancels/completes.
/// Confirming an ONLINE meeting requires a meetingLink in the body (the
/// Zoom/Google Meet link the developer created themselves and is pasting
/// in) unless one was already saved on an earlier confirm.
const updateMeetingStatus = asyncHandler(async (req, res) => {
  const meeting = await prisma.developerMeeting.findUnique({
    where: { id: req.params.id },
    include: { developer: true },
  });
  if (!meeting) throw new ApiError(404, 'Meeting not found');
  if (meeting.developer.userId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only the assigned developer can update this meeting');
  }

  const parsed = meetingStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  if (parsed.data.status === 'CONFIRMED' && meeting.mode === 'ONLINE' && !parsed.data.meetingLink && !meeting.meetingLink) {
    throw new ApiError(400, 'Paste your Zoom/Google Meet link before confirming this online meeting');
  }

  const updated = await prisma.developerMeeting.update({
    where: { id: meeting.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.meetingLink ? { meetingLink: parsed.data.meetingLink } : {}),
    },
  });

  await notifyUser(
    meeting.residentId,
    'Meeting update',
    parsed.data.meetingLink
      ? `Your meeting "${meeting.subject}" is confirmed. Join link: ${parsed.data.meetingLink}`
      : `Your meeting "${meeting.subject}" is now ${parsed.data.status.toLowerCase()}.`
  );

  res.json({ meeting: updated });
});

module.exports = { createMeeting, listMyMeetings, listDeveloperMeetings, updateMeetingStatus };
