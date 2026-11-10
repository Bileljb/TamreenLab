-- DropIndex
DROP INDEX "PointEvent_day_userId_idx";

-- CreateIndex
CREATE INDEX "PointEvent_day_userId_delta_idx" ON "PointEvent"("day", "userId", "delta");
