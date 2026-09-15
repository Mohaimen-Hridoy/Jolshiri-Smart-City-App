const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const { appointmentCreateSchema, appointmentStatusSchema } = require('../utils/validation.part3');

/// Part 9: Authority Portal — Appointments. A resident requests a visit
/// slot with an office (Notices / Appointments / Offices tabs in the
/// Flutter app's AuthorityScreen); a JOLSHIRI_MANAGEMENT admin reviews it.

/// POST /api/appointments
const createAppointment = asyncHandler(async (req, res) => {
  const parsed = appointmentCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const preferredDate = new Date(parsed.data.preferredDate);
  if (Number.isNaN(preferredDate.getTime())) {
    throw new ApiError(400, 'preferredDate must be a valid date');
  }

  const appointment = await prisma.appointment.create({
    data: {
      officeName: parsed.data.officeName,
      reason: parsed.data.reason,
      preferredDate,
      requestedById: req.user.id,
    },
  });

  res.status(201).json({ appointment });
});

/// GET /api/appointments/mine — the calling resident's own appointments
const listMyAppointments = asyncHandler(async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { requestedById: req.user.id },
    orderBy: { preferredDate: 'desc' },
  });
  res.json({ appointments });
});

/// GET /api/appointments?status= — JOLSHIRI_MANAGEMENT admin, all appointments
const listAppointments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const appointments = await prisma.appointment.findMany({
    where,
    include: { requestedBy: { select: { fullName: true, phone: true } } },
    orderBy: { preferredDate: 'asc' },
  });
  res.json({ appointments });
});

/// PATCH /api/appointments/:id/status — admin confirms / cancels
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Appointment not found');

  const parsed = appointmentStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const appointment = await prisma.appointment.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
  });

  await notifyUser(
    appointment.requestedById,
    'Appointment update',
    `Your appointment with ${appointment.officeName} is now ${appointment.status.toLowerCase()}.`
  );

  res.json({ appointment });
});

module.exports = { createAppointment, listMyAppointments, listAppointments, updateAppointmentStatus };
