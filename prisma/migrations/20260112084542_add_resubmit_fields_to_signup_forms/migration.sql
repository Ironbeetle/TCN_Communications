-- AlterTable
ALTER TABLE "SignUpForm" ADD COLUMN     "allowResubmit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resubmitMessage" TEXT;
