-- Steps are matched by their content slug, never by order (ADR 005).
-- AlterTable
ALTER TABLE "Step" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Step_lessonId_slug_key" ON "Step"("lessonId", "slug");
