-- AlterTable
ALTER TABLE "Streak" ADD COLUMN     "freezeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freezeUsedOn" DATE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGoal" INTEGER NOT NULL DEFAULT 900,
ADD COLUMN     "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailOptInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueDay" DATE NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("userId","stepId")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewItem_userId_dueDay_idx" ON "ReviewItem"("userId", "dueDay");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_userId_kind_periodKey_key" ON "EmailLog"("userId", "kind", "periodKey");

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
