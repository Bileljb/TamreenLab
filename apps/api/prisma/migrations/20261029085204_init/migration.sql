-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('CONCEPT', 'PRACTICE', 'SUMMARY', 'CASE_STUDY');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('SELECT_CELL', 'SELECT_RANGE', 'ENTER_VALUE', 'ENTER_FORMULA', 'SHORTCUT', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "LessonKind" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "summaryAr" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "seoJson" JSONB,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "StepType" NOT NULL,
    "promptAr" TEXT NOT NULL,
    "sheetJson" JSONB NOT NULL,
    "checkJson" JSONB NOT NULL,
    "hintAr" TEXT,
    "explainAr" TEXT,
    "basePoints" INTEGER NOT NULL DEFAULT 300,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "firstTry" BOOLEAN NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "stepsDone" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "firstTryRate" DOUBLE PRECISION,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "userId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastDay" DATE,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Track_slug_key" ON "Track"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Step_lessonId_order_key" ON "Step"("lessonId", "order");

-- CreateIndex
CREATE INDEX "Attempt_userId_stepId_idx" ON "Attempt"("userId", "stepId");

-- CreateIndex
CREATE INDEX "PointEvent_day_userId_idx" ON "PointEvent"("day", "userId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
