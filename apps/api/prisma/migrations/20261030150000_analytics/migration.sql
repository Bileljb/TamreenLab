-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lessonSlug" TEXT,
    "stepSlug" TEXT,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_day_idx" ON "AnalyticsEvent"("name", "day");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_anonId_idx" ON "AnalyticsEvent"("anonId");

