-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'BAND_OFFICE',
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "pin" TEXT,
    "pinExpiresAt" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordResetRequested" TIMESTAMP(3),
    "passwordResetCompleted" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failReason" TEXT,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageIds" TEXT NOT NULL,
    "error" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "attachments" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmailLog" (
    "id" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "error" TEXT,
    "attachments" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StaffEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinApiLog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "poster_url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CHIEFNCOUNCIL',
    "userId" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MsgCnC" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'notice',
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,

    CONSTRAINT "MsgCnC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignUpForm" (
    "id" TEXT NOT NULL,
    "portalFormId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "maxEntries" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SignUpForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "responses" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "SignUpForm_portalFormId_key" ON "SignUpForm"("portalFormId");

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmailLog" ADD CONSTRAINT "StaffEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinApiLog" ADD CONSTRAINT "BulletinApiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MsgCnC" ADD CONSTRAINT "MsgCnC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUpForm" ADD CONSTRAINT "SignUpForm_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignUpForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SignUpForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
