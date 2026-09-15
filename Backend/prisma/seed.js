/**
 * Jolshiri Smart City — Database Seed Script
 * Run: npm run seed  (or: node prisma/seed.js)
 *
 * Creates one representative user for every role, plus sample data for
 * every model so every Flutter screen has something to display from day one.
 *
 * All passwords are "Password1" — change them before any demo/production use.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();
const HASH = bcrypt.hashSync('Password1', 10);

async function main() {
  console.log('🌱  Seeding Jolshiri database …');

  // ── 1. Users ──────────────────────────────────────────────────────────────

  // Admin accounts (one per admin type)
  const adminJM = await upsertUser({
    email: 'admin.jm@jolshiri.army.bd',
    fullName: 'Jolshiri Management HQ',
    phone: '+880 2-222-0001',
    role: 'ADMIN',
    adminType: 'JOLSHIRI_MANAGEMENT',
  });

  const adminAO = await upsertUser({
    email: 'admin.ao@jolshiri.army.bd',
    fullName: 'Army Oversight Command',
    phone: '+880 2-222-0002',
    role: 'ADMIN',
    adminType: 'ARMY_OVERSIGHT',
  });

  await upsertUser({
    email: 'admin.sm@jolshiri.army.bd',
    fullName: 'System Moderator',
    phone: '+880 2-222-0003',
    role: 'ADMIN',
    adminType: 'SYSTEM_MODERATOR',
  });

  // Resident / owner accounts
  const fatima = await upsertUser({
    email: 'fatima.ashraf@jolshiri.army.bd',
    fullName: 'Fatima Ashraf',
    phone: '+880 1711-223344',
    role: 'RESIDENT_OWNER',
    plotNumber: '7-142',
    sectorNumber: 7,
    constructionStatus: 'COMPLETED',
    rentStatus: 'OWNER_OCCUPIED',
  });

  const karim = await upsertUser({
    email: 'karim.hossain@jolshiri.army.bd',
    fullName: 'Karim Hossain',
    phone: '+880 1811-334455',
    role: 'RESIDENT_OWNER',
    plotNumber: '12-078',
    sectorNumber: 12,
    constructionStatus: 'UNDER_CONSTRUCTION',
    rentStatus: 'NOT_RENTING',
  });

  const sultana = await upsertUser({
    email: 'sultana.begum@jolshiri.army.bd',
    fullName: 'Sultana Begum',
    phone: '+880 1911-445566',
    role: 'RESIDENT_OWNER',
    plotNumber: '3-015',
    sectorNumber: 3,
    constructionStatus: 'NOT_STARTED',
    rentStatus: 'RENTING_OUT',
  });

  // Developer account
  const devUser = await upsertUser({
    email: 'dev@buildwell.com.bd',
    fullName: 'Rashed Iqbal',
    phone: '+880 1612-556677',
    role: 'DEVELOPER',
  });

  const devUser2 = await upsertUser({
    email: 'dev@greenarch.com.bd',
    fullName: 'Nusrat Jahan',
    phone: '+880 1512-667788',
    role: 'DEVELOPER',
  });

  // Service provider accounts
  const spElec = await upsertUser({
    email: 'elec@jolshiri.services.bd',
    fullName: 'Alam Electric Works',
    phone: '+880 1311-778899',
    role: 'SERVICE_PROVIDER',
  });

  const spPlumb = await upsertUser({
    email: 'plumb@jolshiri.services.bd',
    fullName: 'Mia Plumbing Co.',
    phone: '+880 1411-889900',
    role: 'SERVICE_PROVIDER',
  });

  const spDriver = await upsertUser({
    email: 'driver@jolshiri.services.bd',
    fullName: 'Rafiq Driver Services',
    phone: '+880 1711-990011',
    role: 'SERVICE_PROVIDER',
  });

  console.log('  ✔  Users');

  // ── 2. Developer Profiles ─────────────────────────────────────────────────

  const dev1 = await upsertDeveloper(devUser.id, {
    companyName: 'BuildWell Construction Ltd.',
    contact: devUser.phone,
    specialty: 'Residential & Commercial',
    verified: true,
    rating: 4.5,
  });

  const dev2 = await upsertDeveloper(devUser2.id, {
    companyName: 'GreenArch Builders',
    contact: devUser2.phone,
    specialty: 'Eco-friendly Design',
    verified: true,
    rating: 4.2,
  });

  console.log('  ✔  Developer profiles');

  // ── 3. Service Provider Profiles ──────────────────────────────────────────

  const prov1 = await upsertProvider(spElec.id, {
    name: 'Alam Electric Works',
    serviceType: 'Electrician',
    phone: spElec.phone,
    verified: true,
    rating: 4.7,
    reviews: 23,
  });

  const prov2 = await upsertProvider(spPlumb.id, {
    name: 'Mia Plumbing Co.',
    serviceType: 'Plumber',
    phone: spPlumb.phone,
    verified: true,
    rating: 4.3,
    reviews: 15,
  });

  const prov3 = await upsertProvider(spDriver.id, {
    name: 'Rafiq Driver Services',
    serviceType: 'Driver',
    phone: spDriver.phone,
    verified: false,
    rating: 4.0,
    reviews: 8,
  });

  console.log('  ✔  Service provider profiles');

  // ── 4. Rental Listings ────────────────────────────────────────────────────

  const rental1 = await upsertRental(sultana.id, {
    title: 'Furnished 3-Bed Apartment',
    location: 'Sector 3, near Lake Park',
    rentAmount: '৳ 35,000 / month',
    availability: 'Available from Sep 1',
    description: 'South-facing, 1,800 sqft, generator backup, close to the officers\' mess.',
    bedrooms: 3,
  });

  const rental2 = await upsertRental(sultana.id, {
    title: 'Semi-Furnished 2-Bed Flat',
    location: 'Sector 7, Golf View',
    rentAmount: '৳ 25,000 / month',
    availability: 'Available Now',
    description: 'Newly renovated, covered parking, 24/7 security, easy access to main gate.',
    bedrooms: 2,
  });

  console.log('  ✔  Rental listings');

  // ── 5b. Rental Viewing Requests ───────────────────────────────────────────
  // No viewing requests existed before, so "Flat View Requests" was always
  // empty on both tabs for every account. Fatima and Karim each request a
  // viewing on one of Sultana's listings — gives Sultana something under
  // "Received (my listings)" and gives Fatima/Karim something under
  // "Sent by me".

  await prisma.rentalViewingRequest.upsert({
    where: { id: 'seed-viewreq-1' },
    update: {},
    create: {
      id: 'seed-viewreq-1',
      listingId: rental1.id,
      requesterId: fatima.id,
      requesterName: fatima.fullName,
      requesterPhone: fatima.phone,
      note: 'Interested in viewing this weekend — is Saturday afternoon possible?',
      status: 'PENDING',
    },
  });

  await prisma.rentalViewingRequest.upsert({
    where: { id: 'seed-viewreq-2' },
    update: {},
    create: {
      id: 'seed-viewreq-2',
      listingId: rental2.id,
      requesterId: karim.id,
      requesterName: karim.fullName,
      requesterPhone: karim.phone,
      note: 'Looking to move in next month. Can I see the flat this week?',
      status: 'ACCEPTED',
    },
  });

  console.log('  ✔  Rental viewing requests');

  // ── 6. Offices ────────────────────────────────────────────────────────────

  await Promise.all([
    upsertOffice({ name: 'Jolshiri Management Office', contact: '+880 2-8888-0001', location: 'Admin Zone, Sector 3, Jolshiri Abashon' }),
    upsertOffice({ name: 'Army Oversight Cell', contact: '+880 2-8888-0002', location: 'Security Wing, Sector 1, Jolshiri Abashon' }),
    upsertOffice({ name: 'Resident Services Desk', contact: '+880 2-8888-0003', location: 'Community Centre, Sector 1' }),
    upsertOffice({ name: 'Utility Office (WASA/DESCO)', contact: '+880 2-8888-0004', location: 'Sector 6, Near Main Gate' }),
    upsertOffice({ name: 'Emergency Control Room', contact: '999 / +880 2-8888-9999', location: 'Security Gate 1, Jolshiri Abashon' }),
  ]);

  console.log('  ✔  Offices');

  // ── 7. Notices ────────────────────────────────────────────────────────────

  await Promise.all([
    prisma.notice.upsert({
      where: { id: 'seed-notice-1' },
      update: {},
      create: { id: 'seed-notice-1', title: 'Road Resurfacing — Sector 7', description: 'Main road in Sector 7 will be resurfaced from 25 Aug – 2 Sep. Residents are requested to use alternate routes.', category: 'Infrastructure', publishedById: adminJM.id },
    }),
    prisma.notice.upsert({
      where: { id: 'seed-notice-2' },
      update: {},
      create: { id: 'seed-notice-2', title: 'Water Supply Maintenance', description: 'Scheduled maintenance on 28 Aug (08:00 – 14:00). Water supply will be interrupted in Sectors 3, 5, and 7.', category: 'Utility', publishedById: adminJM.id },
    }),
    prisma.notice.upsert({
      where: { id: 'seed-notice-3' },
      update: {},
      create: { id: 'seed-notice-3', title: 'Community Cleanliness Drive', description: 'All residents are encouraged to participate in the monthly cleanliness drive on 30 Aug at 07:00. Cleaning materials will be provided.', category: 'Community', publishedById: adminJM.id },
    }),
    prisma.notice.upsert({
      where: { id: 'seed-notice-4' },
      update: {},
      create: { id: 'seed-notice-4', title: 'Visitor Pass Update', description: 'New visitor pass policy effective 1 Sep. All guests must register at Gate 1 before entry. Pre-registration via the app is encouraged.', category: 'Security', publishedById: adminAO.id },
    }),
  ]);

  console.log('  ✔  Notices');

  // ── 8. Construction Project ───────────────────────────────────────────────

  const project = await prisma.constructionProject.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      projectName: 'Karim Residence',
      plotReference: '12-078',
      residentId: karim.id,
      developerId: dev1.id,
      estimatedCompletion: 'December 2026',
      permitStatus: 'APPROVED',
    },
  });

  await Promise.all([
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-1' },
      update: {},
      create: { id: 'seed-stage-1', projectId: project.id, title: 'Foundation', description: 'Soil test completed. Pile-driving and raft foundation work.', progress: 100, status: 'COMPLETED', eta: 'Apr 2026', order: 0, developerNote: 'Foundation completed ahead of schedule.' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-2' },
      update: {},
      create: { id: 'seed-stage-2', projectId: project.id, title: 'Structural Frame', description: 'Column and beam casting for all 5 floors.', progress: 65, status: 'IN_PROGRESS', eta: 'Oct 2026', order: 1, developerNote: 'Ground and 1st floor columns cast. 2nd floor ongoing.' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-3' },
      update: {},
      create: { id: 'seed-stage-3', projectId: project.id, title: 'Brickwork & Plaster', description: 'Interior and exterior brickwork and plastering.', progress: 0, status: 'UPCOMING', eta: 'Nov 2026', order: 2, developerNote: '' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-4' },
      update: {},
      create: { id: 'seed-stage-4', projectId: project.id, title: 'Finishing & Handover', description: 'Tiles, paint, fixtures, and final inspection.', progress: 0, status: 'UPCOMING', eta: 'Dec 2026', order: 3, developerNote: '' },
    }),
  ]);

  console.log('  ✔  Construction project & stages');

  // ── 8b. Second Construction Project (GreenArch / Sultana) ────────────────
  // Only one project existed before (Karim + BuildWell), so any screen
  // filtered to the *other* developer (GreenArch) or to a resident without
  // a project (Sultana) always rendered empty. Sultana already has a
  // soil-test permit granted below, so a project actually starting makes
  // sense as her next step.

  const project2 = await prisma.constructionProject.upsert({
    where: { id: 'seed-project-2' },
    update: {},
    create: {
      id: 'seed-project-2',
      projectName: 'Sultana Residence',
      plotReference: '3-015',
      residentId: sultana.id,
      developerId: dev2.id,
      estimatedCompletion: 'March 2027',
      permitStatus: 'APPROVED',
    },
  });

  await Promise.all([
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-5' },
      update: {},
      create: { id: 'seed-stage-5', projectId: project2.id, title: 'Foundation', description: 'Soil test complete. Pile-driving and raft foundation work.', progress: 35, status: 'IN_PROGRESS', eta: 'Jan 2027', order: 0, developerNote: 'Piling started this week; on schedule.' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-6' },
      update: {},
      create: { id: 'seed-stage-6', projectId: project2.id, title: 'Structural Frame', description: 'Column and beam casting for all floors.', progress: 0, status: 'UPCOMING', eta: 'Feb 2027', order: 1, developerNote: '' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-7' },
      update: {},
      create: { id: 'seed-stage-7', projectId: project2.id, title: 'Brickwork & Plaster', description: 'Interior and exterior brickwork and plastering.', progress: 0, status: 'UPCOMING', eta: 'Mar 2027', order: 2, developerNote: '' },
    }),
    prisma.constructionStage.upsert({
      where: { id: 'seed-stage-8' },
      update: {},
      create: { id: 'seed-stage-8', projectId: project2.id, title: 'Finishing & Handover', description: 'Tiles, paint, fixtures, and final inspection.', progress: 0, status: 'UPCOMING', eta: 'Mar 2027', order: 3, developerNote: '' },
    }),
  ]);

  console.log('  ✔  Second construction project & stages (GreenArch / Sultana)');

  // ── 9. Soil Test Application ──────────────────────────────────────────────

  await prisma.soilTestApplication.upsert({
    where: { id: 'seed-soil-1' },
    update: {},
    create: {
      id: 'seed-soil-1',
      applicantId: sultana.id,
      plotReference: '3-015',
      projectName: 'Sultana Residence',
      status: 'PERMIT_GRANTED',
      note: 'Permit granted — pay the testing fee to schedule your visit.',
    },
  });

  console.log('  ✔  Soil test application');

  // ── 10. Service Bookings & Quote Requests ─────────────────────────────────

  await prisma.serviceBooking.upsert({
    where: { id: 'seed-booking-1' },
    update: {},
    create: {
      id: 'seed-booking-1',
      customerId: fatima.id,
      providerId: prov1.id,
      serviceType: 'Electrical inspection',
      address: 'Plot 7-142, Sector 7',
      note: 'Need all wiring inspected before Eid.',
      status: 'ACCEPTED',
    },
  });

  await prisma.quoteRequest.upsert({
    where: { id: 'seed-quote-1' },
    update: {},
    create: {
      id: 'seed-quote-1',
      customerId: sultana.id,
      developerId: dev2.id,
      projectType: 'Residential villa',
      plotLocation: 'Plot 3-015, Sector 3',
      budget: '৳ 1,20,00,000',
      note: 'Looking for eco-friendly, 4-bed design.',
      status: 'PENDING',
    },
  });

  console.log('  ✔  Service bookings & quote requests');

  // ── 11. Developer Meeting ─────────────────────────────────────────────────

  await prisma.developerMeeting.upsert({
    where: { id: 'seed-meeting-1' },
    update: {},
    create: {
      id: 'seed-meeting-1',
      developerId: dev1.id,
      residentId: karim.id,
      subject: 'Q3 Construction Progress Review',
      plotReference: '12-078',
      mode: 'ONLINE',
      platform: 'GOOGLE_MEET',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      note: 'Please bring latest payment receipts.',
      status: 'CONFIRMED',
    },
  });

  console.log('  ✔  Developer meeting');

  // ── 12. Complaints ────────────────────────────────────────────────────────

  const complaint = await prisma.complaint.upsert({
    where: { id: 'seed-complaint-1' },
    update: {},
    create: {
      id: 'seed-complaint-1',
      residentId: fatima.id,
      title: 'Broken street light at Sector 7 junction',
      category: 'Infrastructure',
      description: 'The street light at the Sector 7 / Sector 8 junction has been non-functional for 2 weeks creating a safety hazard at night.',
      plotReference: '7-142',
      status: 'IN_PROGRESS',
      progress: 40,
    },
  });

  await Promise.all([
    prisma.complaintUpdate.upsert({
      where: { id: 'seed-cup-1' },
      update: {},
      create: { id: 'seed-cup-1', complaintId: complaint.id, authorId: null, note: 'Complaint submitted.', status: 'SUBMITTED' },
    }),
    prisma.complaintUpdate.upsert({
      where: { id: 'seed-cup-2' },
      update: {},
      create: { id: 'seed-cup-2', complaintId: complaint.id, authorId: adminJM.id, note: 'Work order raised with the maintenance team. Replacement bulb ordered.', status: 'IN_PROGRESS' },
    }),
  ]);

  console.log('  ✔  Complaints');

  // ── 12b. More complaints (variety of statuses) ────────────────────────────
  // Only one complaint existed before, always for Fatima — any other
  // resident's complaint list, or a filter on SUBMITTED/RESOLVED, rendered
  // empty. Add one per remaining status.

  const complaint2 = await prisma.complaint.upsert({
    where: { id: 'seed-complaint-2' },
    update: {},
    create: {
      id: 'seed-complaint-2',
      residentId: karim.id,
      title: 'Water pressure too low',
      category: 'Utility',
      description: 'Water pressure has dropped noticeably over the past week, especially in the mornings. Please inspect the sector pump.',
      plotReference: '12-078',
      status: 'SUBMITTED',
      progress: 0,
    },
  });

  await prisma.complaintUpdate.upsert({
    where: { id: 'seed-cup-3' },
    update: {},
    create: { id: 'seed-cup-3', complaintId: complaint2.id, authorId: null, note: 'Complaint submitted.', status: 'SUBMITTED' },
  });

  const complaint3 = await prisma.complaint.upsert({
    where: { id: 'seed-complaint-3' },
    update: {},
    create: {
      id: 'seed-complaint-3',
      residentId: sultana.id,
      title: 'Garbage not collected on schedule',
      category: 'Sanitation',
      description: 'Garbage collection has been missed twice this month on Sector 3, Block C.',
      plotReference: '3-015',
      status: 'RESOLVED',
      progress: 100,
    },
  });

  await Promise.all([
    prisma.complaintUpdate.upsert({
      where: { id: 'seed-cup-4' },
      update: {},
      create: { id: 'seed-cup-4', complaintId: complaint3.id, authorId: null, note: 'Complaint submitted.', status: 'SUBMITTED' },
    }),
    prisma.complaintUpdate.upsert({
      where: { id: 'seed-cup-5' },
      update: {},
      create: { id: 'seed-cup-5', complaintId: complaint3.id, authorId: adminJM.id, note: 'Route re-scheduled with the sanitation contractor. Issue resolved.', status: 'RESOLVED' },
    }),
  ]);

  console.log('  ✔  Additional complaints');

  // ── 13. Payments ──────────────────────────────────────────────────────────

  await Promise.all([
    prisma.paymentRecord.upsert({
      where: { reference: 'JLS-SEED00001' },
      update: {},
      create: {
        userId: fatima.id,
        title: 'Developer Consultation Fee',
        description: 'Initial consultation fee for BuildWell Construction Ltd.',
        purpose: 'CONSULTATION_FEE',
        amount: '৳ 5,000',
        reference: 'JLS-SEED00001',
        status: 'DUE',
      },
    }),
    prisma.paymentRecord.upsert({
      where: { reference: 'JLS-SEED00002' },
      update: {},
      create: {
        userId: karim.id,
        title: 'Development Agreement — Q3 Instalment',
        description: 'Third instalment for Karim Residence construction agreement.',
        purpose: 'DEVELOPMENT_AGREEMENT',
        amount: '৳ 4,50,000',
        reference: 'JLS-SEED00002',
        status: 'PAID',
      },
    }),
    prisma.paymentRecord.upsert({
      where: { reference: 'JLS-SEED00003' },
      update: {},
      create: {
        id: 'seed-soil-payment-1',
        userId: sultana.id,
        title: 'Soil Test Application Fee',
        description: 'Soil test fee for "Sultana Residence" (3-015).',
        purpose: 'SOIL_TEST_FEE',
        amount: '৳ 2,000',
        reference: 'JLS-SEED00003',
        status: 'DUE',
      },
    }),
  ]);

  // Link the fee above back onto the permit-granted soil test application
  // so the resident's "Pay now" button and the Authority's payment-done
  // notification both resolve to the same record (needs the payment row
  // to exist first, hence done after the Promise.all above).
  await prisma.soilTestApplication.update({
    where: { id: 'seed-soil-1' },
    data: { paymentId: 'seed-soil-payment-1' },
  });

  console.log('  ✔  Payments');

  // ── 14. Community Posts ───────────────────────────────────────────────────

  const post1 = await prisma.communityPost.upsert({
    where: { id: 'seed-post-1' },
    update: {},
    create: {
      id: 'seed-post-1',
      authorId: adminJM.id,
      content: 'Reminder: The annual resident general meeting will be held on 15 September at the Community Centre. All residents are encouraged to attend.',
      category: 'Announcement',
    },
  });

  const post2 = await prisma.communityPost.upsert({
    where: { id: 'seed-post-2' },
    update: {},
    create: {
      id: 'seed-post-2',
      authorId: fatima.id,
      content: 'Selling a barely-used dining table set (6 seats, teak wood). Moving abroad next month. Price negotiable.',
      category: 'Buy & Sell',
      price: '৳ 18,000',
    },
  });

  await prisma.communityPost.upsert({
    where: { id: 'seed-post-3' },
    update: {},
    create: {
      id: 'seed-post-3',
      authorId: karim.id,
      content: 'Found a grey cat near the Sector 12 park yesterday evening. No collar. Please contact me if it\'s yours.',
      category: 'Lost & Found',
    },
  });

  // A comment on the buy/sell post
  await prisma.postComment.upsert({
    where: { id: 'seed-comment-1' },
    update: {},
    create: {
      id: 'seed-comment-1',
      postId: post2.id,
      authorId: sultana.id,
      text: 'Still available? I\'m interested.',
    },
  });

  console.log('  ✔  Community posts & comments');

  // ── 15. Security Reports ──────────────────────────────────────────────────

  await prisma.securityReport.upsert({
    where: { id: 'seed-sec-1' },
    update: {},
    create: {
      id: 'seed-sec-1',
      title: 'Suspicious vehicle near Gate 3',
      description: 'A white Microbus with no visible number plate was parked near Gate 3 for over 3 hours on 22 Aug. Driver appeared to be photographing the premises.',
      reporterId: karim.id,
      status: 'In Progress',
    },
  });

  console.log('  ✔  Security reports');

  // ── 16. Notifications ────────────────────────────────────────────────────

  await Promise.all([
    upsertNotification(fatima.id, 'Welcome to Jolshiri', 'Your account has been set up. Explore plots, services, and more from your dashboard.'),
    upsertNotification(fatima.id, 'Payment due', '"Developer Consultation Fee" — ৳ 5,000 is now due.'),
    upsertNotification(fatima.id, 'Booking update', 'Your "Electrical inspection" booking has been accepted.'),
    upsertNotification(karim.id, 'Meeting confirmed', 'Your meeting "Q3 Construction Progress Review" on ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toDateString()} is confirmed.'),
    upsertNotification(sultana.id, 'Soil test scheduled', 'Your soil test for "Sultana Residence" is scheduled for 5 September 2026.'),
  ]);

  console.log('  ✔  Notifications');

  // ── 17. Sample data for any real (non-demo) account ───────────────────────
  // The fixed demo accounts above always get sample data, but real accounts
  // created by hand while testing (e.g. via the signup screen) don't — they
  // start with nothing, which is why "My Construction", "Complaints", and
  // "Flat View Requests" showed empty for them specifically. Find every
  // account that ISN'T one of the demo accounts above and attach the same
  // kind of sample data to it, based on its role — so any new test account
  // created via signup gets populated screens the next time this script runs.
  const demoEmails = new Set([
    'fatima.ashraf@jolshiri.army.bd', 'karim.hossain@jolshiri.army.bd', 'sultana.begum@jolshiri.army.bd',
    'dev@buildwell.com.bd', 'dev@greenarch.com.bd',
    'elec@jolshiri.services.bd', 'plumb@jolshiri.services.bd',
    'admin.jm@jolshiri.army.bd', 'admin.ao@jolshiri.army.bd', 'admin.sm@jolshiri.army.bd',
  ]);
  const realAccounts = await prisma.user.findMany({
    where: { email: { notIn: [...demoEmails] } },
    select: { email: true },
  });
  for (const { email } of realAccounts) {
    await seedForExistingAccount(email);
  }

  console.log('\n✅  Seed complete!\n');
  console.log('Test accounts (password: Password1):');
  console.log('  Resident:   fatima.ashraf@jolshiri.army.bd');
  console.log('  Resident:   karim.hossain@jolshiri.army.bd');
  console.log('  Resident:   sultana.begum@jolshiri.army.bd');
  console.log('  Developer:  dev@buildwell.com.bd');
  console.log('  Developer:  dev@greenarch.com.bd');
  console.log('  Provider:   elec@jolshiri.services.bd');
  console.log('  Provider:   plumb@jolshiri.services.bd');
  console.log('  Admin (JM): admin.jm@jolshiri.army.bd');
  console.log('  Admin (AO): admin.ao@jolshiri.army.bd');
  console.log('  Admin (SM): admin.sm@jolshiri.army.bd');
  console.log('\nSample data added: 2 construction projects, 3 complaints, 2 rental viewing requests.');
}

// ── Upsert helpers ─────────────────────────────────────────────────────────

async function upsertUser(data) {
  // Bug 3 Fix: `update: {}` means re-running seed on an existing DB never
  // corrects missing fields (e.g. isEmailVerified was added to the schema
  // after some records were created). Explicitly set the fields that seed
  // accounts must always have so idempotent re-seeding self-heals them.
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      // Ensure seeded accounts are always verified and active — a re-seed
      // after a schema migration should never leave admin accounts locked.
      isEmailVerified: true,
      accountStatus: 'ACTIVE',
    },
    create: {
      ...data,
      passwordHash: HASH,
      isEmailVerified: true,   // seeded accounts skip the OTP flow
      accountStatus: 'ACTIVE',
    },
  });
}

async function upsertDeveloper(userId, data) {
  return prisma.developer.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

async function upsertProvider(userId, data) {
  return prisma.serviceProvider.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

async function upsertRental(ownerId, data) {
  // No unique constraint on rentals — use a synthetic id for idempotency.
  const syntheticId = `seed-rental-${data.title.replace(/\s+/g, '-').toLowerCase()}`;
  return prisma.rentalListing.upsert({
    where: { id: syntheticId },
    update: {},
    create: { id: syntheticId, ownerId, ...data },
  });
}

async function upsertOffice(data) {
  const existing = await prisma.office.findFirst({ where: { name: data.name } });
  if (existing) return existing;
  return prisma.office.create({ data });
}

async function upsertNotification(userId, title, message) {
  const existing = await prisma.appNotification.findFirst({ where: { userId, title } });
  if (existing) return existing;
  return prisma.appNotification.create({ data: { userId, title, message } });
}

// Looks up a real (non-demo) account by email and, if found, attaches
// sample data matching its role — a construction project for a developer,
// or a complaint + construction project + rental viewing requests for a
// resident — using the same idempotent upsert pattern as the rest of this
// file (safe to re-run). Does nothing if no account with that email exists.
async function seedForExistingAccount(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const slug = email.replace(/[^a-zA-Z0-9]/g, '-');

  if (user.role === 'DEVELOPER') {
    const developer = await prisma.developer.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        companyName: `${user.fullName}'s Construction`,
        contact: user.phone || '',
        specialty: 'Residential construction',
        verified: true,
        rating: 4.5,
      },
    });

    // Reuse Karim as the resident on this sample project so it doesn't
    // need a second real resident account to exist.
    const karim = await prisma.user.findUnique({ where: { email: 'karim.hossain@jolshiri.army.bd' } });
    if (!karim) return;

    const project = await prisma.constructionProject.upsert({
      where: { id: `seed-project-${slug}` },
      update: {},
      create: {
        id: `seed-project-${slug}`,
        projectName: 'Sample Tracked Project',
        plotReference: '12-078',
        residentId: karim.id,
        developerId: developer.id,
        estimatedCompletion: 'June 2027',
        permitStatus: 'APPROVED',
      },
    });

    await Promise.all([
      prisma.constructionStage.upsert({
        where: { id: `seed-stage-${slug}-1` },
        update: {},
        create: { id: `seed-stage-${slug}-1`, projectId: project.id, title: 'Foundation', description: 'Soil test completed. Pile-driving and raft foundation work.', progress: 100, status: 'COMPLETED', eta: 'Feb 2027', order: 0, developerNote: 'Foundation completed.' },
      }),
      prisma.constructionStage.upsert({
        where: { id: `seed-stage-${slug}-2` },
        update: {},
        create: { id: `seed-stage-${slug}-2`, projectId: project.id, title: 'Structural Frame', description: 'Column and beam casting.', progress: 45, status: 'IN_PROGRESS', eta: 'Apr 2027', order: 1, developerNote: 'Ground floor columns cast.' },
      }),
      prisma.constructionStage.upsert({
        where: { id: `seed-stage-${slug}-3` },
        update: {},
        create: { id: `seed-stage-${slug}-3`, projectId: project.id, title: 'Brickwork & Plaster', description: 'Interior and exterior brickwork and plastering.', progress: 0, status: 'UPCOMING', eta: 'May 2027', order: 2, developerNote: '' },
      }),
      prisma.constructionStage.upsert({
        where: { id: `seed-stage-${slug}-4` },
        update: {},
        create: { id: `seed-stage-${slug}-4`, projectId: project.id, title: 'Finishing & Handover', description: 'Tiles, paint, fixtures, and final inspection.', progress: 0, status: 'UPCOMING', eta: 'Jun 2027', order: 3, developerNote: '' },
      }),
    ]);

    console.log(`  ✔  Sample construction project attached to ${email}`);
  }

  if (user.role === 'RESIDENT_OWNER') {
    // (a) Complaints tab — one open complaint.
    const complaint = await prisma.complaint.upsert({
      where: { id: `seed-complaint-${slug}` },
      update: {},
      create: {
        id: `seed-complaint-${slug}`,
        residentId: user.id,
        title: 'Streetlight not working',
        category: 'Utility',
        description: 'The streetlight outside my plot has been off for several nights.',
        plotReference: user.plotNumber || '7-142',
        status: 'IN_PROGRESS',
        progress: 50,
      },
    });
    await prisma.complaintUpdate.upsert({
      where: { id: `seed-cup-${slug}` },
      update: {},
      create: { id: `seed-cup-${slug}`, complaintId: complaint.id, authorId: null, note: 'Complaint submitted.', status: 'SUBMITTED' },
    });

    // (b) My Construction tab — reuse BuildWell (dev1) as the developer so
    // it doesn't need a second real developer account to exist.
    const buildwell = await prisma.user.findUnique({ where: { email: 'dev@buildwell.com.bd' } });
    const dev1 = buildwell ? await prisma.developer.findUnique({ where: { userId: buildwell.id } }) : null;
    if (dev1) {
      const project = await prisma.constructionProject.upsert({
        where: { id: `seed-project-${slug}` },
        update: {},
        create: {
          id: `seed-project-${slug}`,
          projectName: `${user.fullName}'s Residence`,
          plotReference: user.plotNumber || '9-201',
          residentId: user.id,
          developerId: dev1.id,
          estimatedCompletion: 'December 2027',
          permitStatus: 'APPROVED',
        },
      });
      await Promise.all([
        prisma.constructionStage.upsert({
          where: { id: `seed-rstage-${slug}-1` },
          update: {},
          create: { id: `seed-rstage-${slug}-1`, projectId: project.id, title: 'Foundation', description: 'Soil test completed. Pile-driving and raft foundation work.', progress: 100, status: 'COMPLETED', eta: 'Mar 2027', order: 0, developerNote: 'Foundation completed.' },
        }),
        prisma.constructionStage.upsert({
          where: { id: `seed-rstage-${slug}-2` },
          update: {},
          create: { id: `seed-rstage-${slug}-2`, projectId: project.id, title: 'Structural Frame', description: 'Column and beam casting.', progress: 30, status: 'IN_PROGRESS', eta: 'Jul 2027', order: 1, developerNote: 'Ground floor columns cast.' },
        }),
        prisma.constructionStage.upsert({
          where: { id: `seed-rstage-${slug}-3` },
          update: {},
          create: { id: `seed-rstage-${slug}-3`, projectId: project.id, title: 'Brickwork & Plaster', description: 'Interior and exterior brickwork and plastering.', progress: 0, status: 'UPCOMING', eta: 'Sep 2027', order: 2, developerNote: '' },
        }),
        prisma.constructionStage.upsert({
          where: { id: `seed-rstage-${slug}-4` },
          update: {},
          create: { id: `seed-rstage-${slug}-4`, projectId: project.id, title: 'Finishing & Handover', description: 'Tiles, paint, fixtures, and final inspection.', progress: 0, status: 'UPCOMING', eta: 'Dec 2027', order: 3, developerNote: '' },
        }),
      ]);
    }

    // (c) Flat View Requests — "Received (my listings)" tab: give this
    // account its own rental listing, with Karim requesting a viewing.
    const rentalId = `seed-rental-${slug}`;
    await prisma.rentalListing.upsert({
      where: { id: rentalId },
      update: {},
      create: {
        id: rentalId,
        ownerId: user.id,
        title: 'Cozy 2-Bed Apartment',
        location: `Sector ${user.plotNumber?.split('-')[0] || '5'}, Jolshiri Abashon`,
        rentAmount: '৳ 22,000 / month',
        availability: 'Available Now',
        description: 'Well-maintained flat, close to the community centre.',
        bedrooms: 2,
      },
    });
    const karimForView = await prisma.user.findUnique({ where: { email: 'karim.hossain@jolshiri.army.bd' } });
    if (karimForView) {
      await prisma.rentalViewingRequest.upsert({
        where: { id: `seed-viewreq-in-${slug}` },
        update: {},
        create: {
          id: `seed-viewreq-in-${slug}`,
          listingId: rentalId,
          requesterId: karimForView.id,
          requesterName: karimForView.fullName,
          requesterPhone: karimForView.phone,
          note: 'Is this flat still available? I would like to see it this week.',
          status: 'PENDING',
        },
      });
    }

    // (d) Flat View Requests — "Sent by me" tab: have this account request
    // a viewing on one of Sultana's seeded listings.
    const sultanaListing = await prisma.rentalListing.findFirst({
      where: { id: 'seed-rental-furnished-3-bed-apartment' },
    });
    if (sultanaListing && sultanaListing.ownerId !== user.id) {
      await prisma.rentalViewingRequest.upsert({
        where: { id: `seed-viewreq-out-${slug}` },
        update: {},
        create: {
          id: `seed-viewreq-out-${slug}`,
          listingId: sultanaListing.id,
          requesterId: user.id,
          requesterName: user.fullName,
          requesterPhone: user.phone || 'N/A',
          note: 'Interested in viewing this weekend — is Saturday afternoon possible?',
          status: 'PENDING',
        },
      });
    }

    console.log(`  ✔  Sample complaint, construction project, and viewing requests attached to ${email}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
