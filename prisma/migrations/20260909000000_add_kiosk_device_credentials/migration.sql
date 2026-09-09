-- AlterTable
ALTER TABLE "KioskDevice" ADD COLUMN "rotatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "KioskDevice" ADD COLUMN "failedPinAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "KioskDevice" ADD COLUMN "lockedUntil" TIMESTAMP(3);
