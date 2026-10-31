-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "locale" TEXT;

-- AlterTable
ALTER TABLE "Step" ADD COLUMN     "localesJson" JSONB NOT NULL DEFAULT '{}';
