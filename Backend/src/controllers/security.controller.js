const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const { securityReportCreateSchema, securityReportStatusSchema } = require('../utils/validation.part3');

/// Part 9: Security/Incident Reports
/// (ARMY_OVERSIGHT / JOLSHIRI_MANAGEMENT) sees every report; any
/// authenticated resident can file one AND needs to see their own
/// "Recent activity" list back on the resident Security screen.

function isSecurityAdmin(user) {
  return user.role === 'ADMIN' && ['JOLSHIRI_MANAGEMENT', 'ARMY_OVERSIGHT'].includes(user.adminType);
}

/// POST /api/security-reports
/// Notifies all ARMY_OVERSIGHT and JOLSHIRI_MANAGEMENT admins when a new
/// report is filed so they see it in their notification feed immediately.
const createReport = asyncHandler(async (req, res) => {
  const parsed = securityReportCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const report = await prisma.securityReport.create({
    data: {
      ...parsed.data,
      reporterId: req.user.id,
      block:     req.body.block     ?? null,
      latitude:  req.body.latitude  != null ? parseFloat(req.body.latitude)  : null,
      longitude: req.body.longitude != null ? parseFloat(req.body.longitude) : null,
      // severity included via parsed.data; DB default (MODERATE) used when omitted.
    },
  });

  // Notify all security admins (ARMY_OVERSIGHT + JOLSHIRI_MANAGEMENT)
  // so the report shows up in their notification bell immediately.
  const securityAdmins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      adminType: { in: ['ARMY_OVERSIGHT', 'JOLSHIRI_MANAGEMENT'] },
      accountStatus: 'ACTIVE',
    },
    select: { id: true },
  });

  const sectorLabel = report.block ? ` (${report.block})` : '';
  const sevLabel = parsed.data.severity
    ? ` — ${parsed.data.severity.charAt(0) + parsed.data.severity.slice(1).toLowerCase()}`
    : '';

  await Promise.all(
    securityAdmins.map(admin =>
      notifyUser(
        admin.id,
        'New security report',
        `"${report.title}"${sectorLabel}${sevLabel} filed by a resident.`
      ).catch(() => {})
    )
  );

  res.status(201).json({ report });
});

/// GET /api/security-reports?status=
/// Security admins get every report (optionally filtered by status);
/// everyone else only gets the reports they personally filed.
const listReports = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = isSecurityAdmin(req.user)
    ? (status ? { status } : {})
    : { reporterId: req.user.id };
  const reports = await prisma.securityReport.findMany({
    where,
    include: { reporter: { select: { fullName: true, phone: true } } },
    orderBy: { reportedAt: 'desc' },
  });
  res.json({ reports });
});

/// Colour tier driven purely by how many reports/SOS alerts a sector has
/// received — NOT by any per-report severity level (mild/moderate/severe
/// options were removed from the incident report form). An SOS alert is
/// just one more report toward this same count; it does not force a
/// sector to RED on its own.
///
///   1–3 reports → GREEN  ('MILD')
///   4–6 reports → ORANGE ('MODERATE')
///   7+ reports  → RED    ('SEVERE')
///
/// The response still uses the field name `severity` (values MILD /
/// MODERATE / SEVERE) so the existing Flutter colour mapping keeps working
/// unchanged — only the value it's derived from has changed.
function tierForCount(count) {
  if (count >= 7) return 'SEVERE';
  if (count >= 4) return 'MODERATE';
  return 'MILD';
}

/// GET /api/security-reports/heatmap
/// ARMY_OVERSIGHT / JOLSHIRI_MANAGEMENT only.
const getHeatmap = asyncHandler(async (req, res) => {
  if (!isSecurityAdmin(req.user)) {
    throw new ApiError(403, 'Only security admins can access the heatmap');
  }

  const reports = await prisma.securityReport.findMany({
    where: { block: { not: null } },
    orderBy: { reportedAt: 'desc' },
    select: {
      id:        true,
      title:     true,
      block:     true,
      latitude:  true,
      longitude: true,
      status:    true,
      reportedAt: true,
    },
  });

  const byBlock = {};
  for (const r of reports) {
    const key = r.block;
    if (!byBlock[key]) {
      byBlock[key] = {
        block:          key,
        incidents:      0,
        statusBreakdown: {},
        latitude:       null,
        longitude:      null,
        topNote:        null,
      };
    }
    const entry = byBlock[key];
    entry.incidents += 1;

    if (entry.latitude == null && r.latitude != null) {
      entry.latitude  = r.latitude;
      entry.longitude = r.longitude;
    }
    if (entry.topNote == null) entry.topNote = r.title;
    entry.statusBreakdown[r.status] = (entry.statusBreakdown[r.status] ?? 0) + 1;
  }

  const noBlock = reports.filter(r => r.block == null);
  if (noBlock.length > 0) {
    byBlock['Unknown'] = {
      block:           'Unknown',
      incidents:       noBlock.length,
      statusBreakdown: noBlock.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {}),
      latitude:  null,
      longitude: null,
      topNote:   noBlock[0]?.title ?? null,
    };
  }

  const clusters = Object.values(byBlock)
    .map(entry => ({ ...entry, severity: tierForCount(entry.incidents) }))
    .sort((a, b) => b.incidents - a.incidents);
  res.json({ clusters });
});

/// GET /api/security-reports/:id
const getReport = asyncHandler(async (req, res) => {
  const report = await prisma.securityReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ApiError(404, 'Security report not found');
  if (report.reporterId !== req.user.id && !isSecurityAdmin(req.user)) {
    throw new ApiError(403, 'You do not have access to this security report');
  }
  res.json({ report });
});

/// PATCH /api/security-reports/:id/status
/// Notifies the resident who filed the report when an admin changes its status.
const updateReportStatus = asyncHandler(async (req, res) => {
  const report = await prisma.securityReport.findUnique({ where: { id: req.params.id } });
  if (!report) throw new ApiError(404, 'Security report not found');

  const parsed = securityReportStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.securityReport.update({
    where: { id: report.id },
    data: { status: parsed.data.status },
  });

  // Notify the resident who filed this report (if we know who they are).
  if (report.reporterId) {
    const statusLabel = parsed.data.status; // 'In Progress' | 'Resolved'
    await notifyUser(
      report.reporterId,
      'Security report update',
      `Your report "${report.title}" is now ${statusLabel.toLowerCase()}.`
    ).catch(() => {});
  }

  res.json({ report: updated });
});

module.exports = { createReport, listReports, getReport, updateReportStatus, getHeatmap };
