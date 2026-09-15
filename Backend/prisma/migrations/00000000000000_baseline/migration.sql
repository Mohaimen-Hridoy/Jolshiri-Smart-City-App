-- Backfill baseline: creates all enums and tables that existed before migrations
-- were introduced. Every statement is guarded so it is a no-op when the object
-- already exists (production path) and creates it when it does not (shadow DB path).

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('RESIDENT_OWNER', 'SERVICE_PROVIDER', 'DEVELOPER', 'ADMIN');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminType') THEN
    CREATE TYPE "AdminType" AS ENUM ('JOLSHIRI_MANAGEMENT', 'ARMY_OVERSIGHT', 'SYSTEM_MODERATOR');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlotConstructionStatus') THEN
    CREATE TYPE "PlotConstructionStatus" AS ENUM ('NOT_STARTED', 'UNDER_CONSTRUCTION', 'COMPLETED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlotRentStatus') THEN
    CREATE TYPE "PlotRentStatus" AS ENUM ('OWNER_OCCUPIED', 'RENTING_OUT', 'NOT_RENTING');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestStatus') THEN
    CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MeetingMode') THEN
    CREATE TYPE "MeetingMode" AS ENUM ('ONLINE', 'OFFLINE');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MeetingPlatform') THEN
    CREATE TYPE "MeetingPlatform" AS ENUM ('ZOOM', 'GOOGLE_MEET');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MeetingStatus') THEN
    CREATE TYPE "MeetingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConstructionPermitStatus') THEN
    CREATE TYPE "ConstructionPermitStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConstructionStageStatus') THEN
    CREATE TYPE "ConstructionStageStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'UPCOMING', 'DELAYED', 'PENDING_APPROVAL');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SoilTestStatus') THEN
    CREATE TYPE "SoilTestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'REJECTED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplaintStatus') THEN
    CREATE TYPE "ComplaintStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'RESOLVED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentPurpose') THEN
    CREATE TYPE "PaymentPurpose" AS ENUM ('CONSULTATION_FEE', 'DEVELOPMENT_AGREEMENT');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('DUE', 'PROCESSING', 'PAID', 'FAILED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "adminType" "AdminType",
    "address" TEXT NOT NULL DEFAULT 'Jolshiri Abashon, Purbachal, Dhaka',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "plotNumber" TEXT,
    "sectorNumber" INTEGER,
    "constructionStatus" "PlotConstructionStatus",
    "rentStatus" "PlotRentStatus",
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "googleUid" TEXT,
    "fcmToken" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RentalListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "rentAmount" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RentalViewingRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterPhone" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "RentalViewingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "viewingRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Developer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialty" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceReview" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceBooking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "plotLocation" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeveloperMeeting" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "plotReference" TEXT NOT NULL,
    "mode" "MeetingMode" NOT NULL DEFAULT 'ONLINE',
    "platform" "MeetingPlatform",
    "meetingLink" TEXT,
    "location" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeveloperMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConstructionProject" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "plotReference" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "estimatedCompletion" TEXT NOT NULL,
    "permitStatus" "ConstructionPermitStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstructionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConstructionStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ConstructionStageStatus" NOT NULL DEFAULT 'UPCOMING',
    "eta" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "developerNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ConstructionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SoilTestApplication" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "plotReference" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SoilTestStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SoilTestApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Complaint" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "plotReference" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ComplaintUpdate" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "amount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DUE',
    "gatewayRef" TEXT,
    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Office" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" TEXT,
    "imageUrl" TEXT,
    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleUid_key" ON "User"("googleUid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Developer_userId_key" ON "Developer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceProvider_userId_key" ON "ServiceProvider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_reference_key" ON "PaymentRecord"("reference");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RentalListing_ownerId_fkey'
  ) THEN
    ALTER TABLE "RentalListing" ADD CONSTRAINT "RentalListing_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RentalViewingRequest_listingId_fkey'
  ) THEN
    ALTER TABLE "RentalViewingRequest" ADD CONSTRAINT "RentalViewingRequest_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "RentalListing"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RentalViewingRequest_requesterId_fkey'
  ) THEN
    ALTER TABLE "RentalViewingRequest" ADD CONSTRAINT "RentalViewingRequest_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Message_viewingRequestId_fkey'
  ) THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_viewingRequestId_fkey"
      FOREIGN KEY ("viewingRequestId") REFERENCES "RentalViewingRequest"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey'
  ) THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Message_receiverId_fkey'
  ) THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Developer_userId_fkey'
  ) THEN
    ALTER TABLE "Developer" ADD CONSTRAINT "Developer_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceProvider_userId_fkey'
  ) THEN
    ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceReview_providerId_fkey'
  ) THEN
    ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceReview_residentId_fkey'
  ) THEN
    ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_residentId_fkey"
      FOREIGN KEY ("residentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceBooking_customerId_fkey'
  ) THEN
    ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceBooking_providerId_fkey'
  ) THEN
    ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuoteRequest_customerId_fkey'
  ) THEN
    ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuoteRequest_developerId_fkey'
  ) THEN
    ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_developerId_fkey"
      FOREIGN KEY ("developerId") REFERENCES "Developer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeveloperMeeting_developerId_fkey'
  ) THEN
    ALTER TABLE "DeveloperMeeting" ADD CONSTRAINT "DeveloperMeeting_developerId_fkey"
      FOREIGN KEY ("developerId") REFERENCES "Developer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeveloperMeeting_residentId_fkey'
  ) THEN
    ALTER TABLE "DeveloperMeeting" ADD CONSTRAINT "DeveloperMeeting_residentId_fkey"
      FOREIGN KEY ("residentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConstructionProject_developerId_fkey'
  ) THEN
    ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_developerId_fkey"
      FOREIGN KEY ("developerId") REFERENCES "Developer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConstructionProject_residentId_fkey'
  ) THEN
    ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_residentId_fkey"
      FOREIGN KEY ("residentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConstructionStage_projectId_fkey'
  ) THEN
    ALTER TABLE "ConstructionStage" ADD CONSTRAINT "ConstructionStage_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SoilTestApplication_applicantId_fkey'
  ) THEN
    ALTER TABLE "SoilTestApplication" ADD CONSTRAINT "SoilTestApplication_applicantId_fkey"
      FOREIGN KEY ("applicantId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Complaint_residentId_fkey'
  ) THEN
    ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_residentId_fkey"
      FOREIGN KEY ("residentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComplaintUpdate_authorId_fkey'
  ) THEN
    ALTER TABLE "ComplaintUpdate" ADD CONSTRAINT "ComplaintUpdate_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComplaintUpdate_complaintId_fkey'
  ) THEN
    ALTER TABLE "ComplaintUpdate" ADD CONSTRAINT "ComplaintUpdate_complaintId_fkey"
      FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_userId_fkey'
  ) THEN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notice_publishedById_fkey'
  ) THEN
    ALTER TABLE "Notice" ADD CONSTRAINT "Notice_publishedById_fkey"
      FOREIGN KEY ("publishedById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_requestedById_fkey'
  ) THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommunityPost_authorId_fkey'
  ) THEN
    ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostComment_postId_fkey'
  ) THEN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostComment_authorId_fkey'
  ) THEN
    ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AppNotification_userId_fkey'
  ) THEN
    ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;