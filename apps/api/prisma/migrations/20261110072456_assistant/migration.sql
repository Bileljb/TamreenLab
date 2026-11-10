-- CreateTable
CREATE TABLE "AssistantHint" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "formulaKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantCall" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "userKey" TEXT,
    "ipKey" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "calledModel" BOOLEAN NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantFeedback" (
    "hintId" TEXT NOT NULL,
    "voter" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("hintId","voter")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantHint_stepId_locale_formulaKey_key" ON "AssistantHint"("stepId", "locale", "formulaKey");

-- CreateIndex
CREATE INDEX "AssistantCall_day_userKey_idx" ON "AssistantCall"("day", "userKey");

-- CreateIndex
CREATE INDEX "AssistantCall_day_ipKey_idx" ON "AssistantCall"("day", "ipKey");

-- CreateIndex
CREATE INDEX "AssistantCall_createdAt_idx" ON "AssistantCall"("createdAt");

-- AddForeignKey
ALTER TABLE "AssistantHint" ADD CONSTRAINT "AssistantHint_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "AssistantHint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
