# Jolshiri Smart City — Backend API

Express + Prisma + PostgreSQL REST API for the Jolshiri Smart City Flutter app.

## Completed Features

| # | Feature | Status | Key files |
|---|---------|--------|-----------|
| 1 | **Google Sign-In (SSO)** | ✅ Done | `src/controllers/auth.controller.js` → `googleSignIn`, `src/config/firebase.js` |
| 2 | **Signup OTP email verification** | ✅ Done | `POST /api/auth/signup` → `POST /api/auth/verify-signup-otp` → `POST /api/auth/resend-signup-otp` |
| 3 | **Forgot password + reset** | ✅ Done | `POST /api/auth/forgot-password` → `POST /api/auth/reset-password`; OTP via Gmail (Nodemailer) |
| 4 | **Army heatmap (Google Maps)** | ✅ Done | `GET /api/security-reports/heatmap`; frontend switched to `google_maps_flutter` with red/orange/green circles |
| 5 | **AI Chatbot** | ✅ Done | `POST /api/chatbot/query`; tries Gemini → OpenAI → Anthropic → keyword fallback |
| 6 | **Soil testing full flow** | ✅ Done | `src/controllers/soilTest.controller.js`; REQUESTED → PERMIT_GRANTED → PAYMENT_DONE → COMPLETED with notifications at each step |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in your database URL + JWT secret
cp .env.example .env

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed the database with sample data (test accounts + realistic content)
npm run seed

# 5. Start the dev server (auto-restarts on file changes)
npm run dev
```

Server listens on **http://localhost:4000** by default.

---

## API Reference

All protected routes require `Authorization: Bearer <token>` obtained from `/api/auth/login`.

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | ❌ | Create account (all roles) |
| POST | `/api/auth/login` | ❌ | Login → JWT |
| GET | `/api/auth/me` | ✅ | Get own profile |
| PATCH | `/api/auth/profile` | ✅ | Update name / phone / address |
| POST | `/api/auth/change-password` | ✅ | Change password |

### Plots (Buy / Sell)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/plots` | ❌ | List plots (`?status=&location=`) |
| GET | `/api/plots/:id` | ❌ | Get single plot |
| POST | `/api/plots` | Admin (JM) | Create plot (with optional `image` file) |
| PATCH | `/api/plots/:id` | Admin (JM) | Update plot |
| DELETE | `/api/plots/:id` | Admin (JM) | Delete plot |

### Rentals (To-Let)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rentals` | ❌ | List rentals (`?location=&minBedrooms=`) |
| GET | `/api/rentals/mine` | ✅ | My listings |
| GET | `/api/rentals/:id` | ❌ | Get single rental |
| POST | `/api/rentals` | Resident / Admin | Create listing (optional `image`) |
| PATCH | `/api/rentals/:id` | Owner / Admin | Update listing |
| DELETE | `/api/rentals/:id` | Owner / Admin | Delete listing |
| POST | `/api/rentals/:id/viewing-requests` | ✅ | Request a viewing |
| GET | `/api/rentals/:id/viewing-requests` | Owner / Admin | Viewing requests for a listing |
| GET | `/api/viewing-requests/mine` | ✅ | My viewing requests |
| PATCH | `/api/viewing-requests/:id/status` | Owner / Admin | Accept / decline / complete |

### Developer Directory
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/developers` | ❌ | List developers (`?specialty=&verified=`) |
| GET | `/api/developers/:id` | ❌ | Get developer |
| PATCH | `/api/developers/:id` | Developer / Admin | Update own profile |
| PATCH | `/api/developers/:id/verify` | Admin | Verify / unverify |

### Service Provider Directory
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/providers` | ❌ | List providers (`?serviceType=&verified=`) |
| GET | `/api/providers/:id` | ❌ | Get provider |
| PATCH | `/api/providers/:id` | Provider / Admin | Update own profile |
| PATCH | `/api/providers/:id/verify` | Admin | Verify / unverify |
| POST | `/api/providers/:id/reviews` | Resident | Submit review |
| GET | `/api/providers/:id/reviews` | ❌ | Get reviews |

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings` | Resident | Book a service |
| GET | `/api/bookings/mine` | ✅ | My bookings (as customer) |
| GET | `/api/bookings/provider` | Provider | Incoming bookings |
| PATCH | `/api/bookings/:id/status` | Provider / Admin | Accept / decline / complete |

### Quote Requests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/quotes` | Resident | Request a quote |
| GET | `/api/quotes/mine` | ✅ | My quote requests |
| GET | `/api/quotes/developer` | Developer | Incoming quote requests |
| PATCH | `/api/quotes/:id/status` | Developer / Admin | Accept / decline / complete |

### Meetings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/meetings` | Resident | Schedule meeting |
| GET | `/api/meetings/mine` | ✅ | My meetings (as resident) |
| GET | `/api/meetings/developer` | Developer | Incoming meetings |
| PATCH | `/api/meetings/:id/status` | Developer / Admin | Confirm / cancel / complete |

### Construction Lifecycle
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/construction/projects` | Developer | Start a project |
| GET | `/api/construction/projects/mine` | ✅ | My projects |
| GET | `/api/construction/projects/:id` | ✅ | Get project with stages |
| PATCH | `/api/construction/projects/:id/permit` | Admin (JM) | Approve / reject permit |
| POST | `/api/construction/projects/:id/stages` | Developer | Submit a new stage |
| PATCH | `/api/construction/stages/:id` | Developer | Update stage (→ PENDING_APPROVAL) |
| PATCH | `/api/construction/stages/:id/review` | Admin (JM) | Approve / send back stage |
| POST | `/api/construction/soil-tests` | Resident | Apply for soil test |
| GET | `/api/construction/soil-tests/mine` | ✅ | My soil test applications |
| GET | `/api/construction/soil-tests` | Admin (JM) | All applications |
| PATCH | `/api/construction/soil-tests/:id/status` | Admin (JM) | Schedule / complete / reject |

### Complaints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/complaints` | Resident | File complaint (optional `image`) |
| GET | `/api/complaints/mine` | ✅ | My complaints |
| GET | `/api/complaints` | Admin (JM) | All complaints (`?status=&category=`) |
| GET | `/api/complaints/:id` | Owner / Admin | Get complaint |
| GET | `/api/complaints/:id/updates` | Owner / Admin | Complaint timeline |
| POST | `/api/complaints/:id/updates` | Admin (JM) | Add update (changes status + progress) |

### Payments (Stripe Checkout)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments` | Admin | Create a DUE payment record |
| GET | `/api/payments/mine` | ✅ | My payment records |
| GET | `/api/payments` | Admin | All payments (`?status=`) |
| GET | `/api/payments/:id` | Owner / Admin | Get payment |
| POST | `/api/payments/:id/pay` | Owner | Initiate Stripe Checkout (→ PROCESSING, returns `checkoutUrl`) |
| GET/POST | `/api/payments/callback` | ❌ (browser redirect) | Display-only landing page after Checkout — does **not** change status |
| POST | `/api/payments/webhook` | Stripe signature | The real source of truth — flips status to PAID / FAILED |
| POST | `/api/payments/manual-confirm` | Admin | Manually resolve a `MOCK-` record when no Stripe key is set |

**Required env vars** (see `services/paymentGateway.js` for details):
- `STRIPE_SECRET_KEY` — `sk_test_...` / `sk_live_...` (Stripe Dashboard → Developers → API keys)
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` (Dashboard → Developers → Webhooks → add endpoint `<APP_BASE_URL>/api/payments/webhook` → Signing secret)
- `APP_BASE_URL` — your public backend URL, e.g. `https://<service>.up.railway.app` (no trailing slash)

Without `STRIPE_SECRET_KEY` set, `/:id/pay` falls back to a mock gateway that auto-resolves to PAID immediately — fine for a demo, but real checkout only happens once the key is set.

### Notices
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notices` | ❌ | List notices (`?category=`) |
| GET | `/api/notices/:id` | ❌ | Get notice |
| POST | `/api/notices` | Admin | Create notice |
| PATCH | `/api/notices/:id` | Admin | Update notice |
| DELETE | `/api/notices/:id` | Admin | Delete notice |

### Offices (Authority Directory)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/offices` | ❌ | List offices |
| POST | `/api/offices` | Admin | Create office entry |
| PATCH | `/api/offices/:id` | Admin | Update office |
| DELETE | `/api/offices/:id` | Admin | Delete office |

### Community Posts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/community-posts` | ❌ | List posts (`?category=`) |
| GET | `/api/community-posts/:id` | ❌ | Get post with comments |
| POST | `/api/community-posts` | ✅ | Create post (optional `image`) |
| PATCH | `/api/community-posts/:id` | Author / Admin | Update post |
| DELETE | `/api/community-posts/:id` | Author / Admin | Delete post |
| POST | `/api/community-posts/:id/comments` | ✅ | Add comment |

### Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications/mine` | ✅ | My notifications |
| PATCH | `/api/notifications/read-all` | ✅ | Mark all as read |
| PATCH | `/api/notifications/:id/read` | ✅ | Mark one as read |

### Security Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/security-reports` | ✅ | File a report |
| GET | `/api/security-reports` | Admin (JM / AO) | All reports (`?status=`) |
| GET | `/api/security-reports/:id` | Admin (JM / AO) | Get report |
| PATCH | `/api/security-reports/:id/status` | Admin (JM / AO) | Update status |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/kpis` | Admin (any) | Dashboard KPI summary |
| GET | `/api/admin/users` | Admin (any) | List all users (`?role=&search=`) |
| GET | `/api/admin/users/:id` | Admin (any) | Get user with profiles |
| DELETE | `/api/admin/users/:id` | Admin (SM) | Delete user account |

---

## Admin Types

| Type | Label | Capabilities |
|------|-------|-------------|
| `JOLSHIRI_MANAGEMENT` | Jolshiri Mgmt | Plots, Permits, Construction, Complaints, Payments, Notices |
| `ARMY_OVERSIGHT` | Army Oversight | Security reports, KPIs |
| `SYSTEM_MODERATOR` | System Moderator | User management, Delete users |

---

## Test Accounts

After running `npm run seed` (password for all: **Password1**):

| Role | Email |
|------|-------|
| Resident | fatima.ashraf@jolshiri.army.bd |
| Resident | karim.hossain@jolshiri.army.bd |
| Resident | sultana.begum@jolshiri.army.bd |
| Developer | dev@buildwell.com.bd |
| Developer | dev@greenarch.com.bd |
| Service Provider | elec@jolshiri.services.bd |
| Service Provider | plumb@jolshiri.services.bd |
| Admin (JM) | admin.jm@jolshiri.army.bd |
| Admin (AO) | admin.ao@jolshiri.army.bd |
| Admin (SM) | admin.sm@jolshiri.army.bd |

---

## Production Checklist

- [ ] Set a strong `JWT_SECRET` (64+ random bytes)
- [ ] Set `NODE_ENV=production`
- [ ] Set `PUBLIC_BASE_URL` to your real domain
- [ ] Replace `services/pushNotification.js` with Firebase Admin SDK (see file)
- [x] Stripe Checkout wired up in `services/paymentGateway.js`, confirmed via a signature-verified webhook (`POST /api/payments/webhook`) rather than the browser redirect — set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_BASE_URL` to go live (see file header)
- [x] Developer meeting links: no auto-generation — the developer pastes their own Zoom/Google Meet link (created in their own account) when confirming an online meeting, since Jolshiri has no safe way to create a meeting under someone else's Zoom/Google credentials (see `controllers/meeting.controller.js#updateMeetingStatus`)
- [ ] Configure a reverse proxy (nginx) with HTTPS
- [ ] Move file uploads from local disk to S3 / Cloudinary (see `middleware/upload.js`)
- [x] `npm start` now runs `prisma migrate deploy` automatically before starting the server, so this happens on every deploy without a manual step
