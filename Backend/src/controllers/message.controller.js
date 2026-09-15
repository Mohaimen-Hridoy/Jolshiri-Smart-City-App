const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const { messageCreateSchema } = require('../utils/validation.part2');

/// Part 2: Property (To-Let) — in-app chat between a viewing request's
/// requester and the listing's owner. One thread per RentalViewingRequest,
/// only the requester and the listing owner (or an admin) may read/post to it.

async function loadRequestForThread(id) {
  const request = await prisma.rentalViewingRequest.findUnique({
    where: { id },
    include: { listing: true },
  });
  if (!request) throw new ApiError(404, 'Viewing request not found');
  return request;
}

function assertParticipant(request, user) {
  const isRequester = request.requesterId === user.id;
  const isOwner = request.listing.ownerId === user.id;
  if (!isRequester && !isOwner && user.role !== 'ADMIN') {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  return { isRequester, isOwner };
}

/// GET /api/viewing-requests/:id/messages — full thread, oldest first.
/// Also marks every message addressed to the caller as read.
const listThread = asyncHandler(async (req, res) => {
  const request = await loadRequestForThread(req.params.id);
  assertParticipant(request, req.user);

  const messages = await prisma.message.findMany({
    where: { viewingRequestId: request.id },
    orderBy: { sentAt: 'asc' },
  });

  await prisma.message.updateMany({
    where: { viewingRequestId: request.id, receiverId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  res.json({
    messages,
    listingTitle: request.listing.title,
    requesterId: request.requesterId,
    requesterName: request.requesterName,
    ownerId: request.listing.ownerId,
  });
});

/// POST /api/viewing-requests/:id/messages — the requester or the listing
/// owner sends a chat message; the other side is notified automatically.
const sendMessage = asyncHandler(async (req, res) => {
  const request = await loadRequestForThread(req.params.id);
  const { isRequester, isOwner } = assertParticipant(request, req.user);

  const parsed = messageCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  if (isRequester || isOwner) {
    const receiverId = isRequester ? request.listing.ownerId : request.requesterId;
    const message = await prisma.message.create({
      data: {
        viewingRequestId: request.id,
        senderId: req.user.id,
        receiverId,
        content: parsed.data.content,
      },
    });

    await notifyUser(
      receiverId,
      'New message',
      `${req.user.fullName} sent you a message about "${request.listing.title}".`
    );

    return res.status(201).json({ message });
  }

  // Bug fix: assertParticipant() above already lets an ADMIN into this
  // thread (to moderate/oversee it), but this endpoint used to always
  // throw "Only the requester or the listing owner can message here" for
  // anyone who wasn't one of those two — including an admin who had just
  // been let in by the exact same check. An admin could read the thread
  // but never reply. Deliver the admin's message to both sides instead.
  if (req.user.role === 'ADMIN') {
    const [toRequester, toOwner] = await prisma.$transaction([
      prisma.message.create({
        data: {
          viewingRequestId: request.id,
          senderId: req.user.id,
          receiverId: request.requesterId,
          content: parsed.data.content,
        },
      }),
      prisma.message.create({
        data: {
          viewingRequestId: request.id,
          senderId: req.user.id,
          receiverId: request.listing.ownerId,
          content: parsed.data.content,
        },
      }),
    ]);

    await Promise.all([
      notifyUser(
        request.requesterId,
        'New message',
        `${req.user.fullName} (Jolshiri admin) sent a message about "${request.listing.title}".`
      ).catch(() => {}),
      notifyUser(
        request.listing.ownerId,
        'New message',
        `${req.user.fullName} (Jolshiri admin) sent a message about "${request.listing.title}".`
      ).catch(() => {}),
    ]);

    return res.status(201).json({ message: toRequester, messages: [toRequester, toOwner] });
  }

  throw new ApiError(403, 'Only the requester or the listing owner can message here');
});

/// GET /api/messages/unread-count — small badge count for the chat icon.
const unreadCount = asyncHandler(async (req, res) => {
  const count = await prisma.message.count({
    where: { receiverId: req.user.id, isRead: false },
  });
  res.json({ count });
});

module.exports = { listThread, sendMessage, unreadCount };
