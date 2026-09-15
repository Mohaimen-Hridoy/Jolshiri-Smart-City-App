require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const { rentalRouter, viewingRequestRouter } = require('./routes/rental.routes');
const { developerRouter, providerRouter } = require('./routes/directory.routes');
const { bookingRouter, quoteRouter } = require('./routes/booking.routes');
const meetingRoutes = require('./routes/meeting.routes');
const { projectRouter, stageRouter, soilTestRouter } = require('./routes/construction.routes');
const complaintRoutes = require('./routes/complaint.routes');
const paymentRoutes = require('./routes/payment.routes');
const { noticeRouter, officeRouter } = require('./routes/notice.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const communityRoutes = require('./routes/community.routes');
const notificationRoutes = require('./routes/notification.routes');
const securityRoutes = require('./routes/security.routes');
const adminRoutes = require('./routes/admin.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const messageRoutes = require('./routes/message.routes');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow images under /uploads to be loaded cross-origin by the Flutter app
app.use(cors());
// Stripe webhook signature verification needs the RAW, untouched request
// body — express.json() below would parse-and-reserialize it, which
// silently breaks the HMAC check. This has to be registered on the exact
// route, before express.json() runs. See services/paymentGateway.js and
// controllers/payment.controller.js#stripeWebhook.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
// SSLCommerz (and most payment gateways) POST their IPN/callback as
// application/x-www-form-urlencoded, not JSON — without this, req.body on
// POST /api/payments/callback was always {} and the callback silently did
// nothing useful.
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Locally-stored images (RentalListing/Complaint photos) — see
// src/middleware/upload.js for how to swap this for S3/Cloudinary.
app.use('/uploads', express.static(UPLOAD_DIR));

// ── Part 1: Auth & User Management ──────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Part 2: Property (To-Let) ────────────────────────────────────────────────
app.use('/api/rentals', rentalRouter);
app.use('/api/viewing-requests', viewingRequestRouter);
app.use('/api/messages', messageRoutes);

// ── Part 3: Developer & Service Provider Directory ──────────────────────────
app.use('/api/developers', developerRouter);
app.use('/api/providers', providerRouter);

// ── Part 4: Bookings & Quotes ────────────────────────────────────────────────
app.use('/api/bookings', bookingRouter);
app.use('/api/quotes', quoteRouter);

// ── Part 5: Developer Meetings ───────────────────────────────────────────────
app.use('/api/meetings', meetingRoutes);

// ── Part 6: Construction Lifecycle ───────────────────────────────────────────
app.use('/api/construction/projects', projectRouter);
app.use('/api/construction/stages', stageRouter);
app.use('/api/construction/soil-tests', soilTestRouter);

// ── Part 7: Complaint Register ───────────────────────────────────────────────
app.use('/api/complaints', complaintRoutes);

// ── Part 8: Payments ──────────────────────────────────────────────────────────
app.use('/api/payments', paymentRoutes);

// ── Part 9: Notices, Community & Notifications ───────────────────────────────
app.use('/api/notices', noticeRouter);
app.use('/api/offices', officeRouter);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/community-posts', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/security-reports', securityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jolshiri backend listening on http://localhost:${PORT}`);
});

module.exports = app;
