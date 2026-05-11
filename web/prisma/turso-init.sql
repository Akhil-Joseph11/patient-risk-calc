-- Idempotent bootstrap for empty Turso DBs. Run: npm run db:apply-turso
-- For evolving schemas on existing databases, prefer: npx prisma db push

CREATE TABLE IF NOT EXISTS "PatientCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT,
    "guestSessionId" TEXT,
    "patientName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "clinicalNotes" TEXT NOT NULL,
    "rawDocumentText" TEXT NOT NULL DEFAULT '',
    "ocrText" TEXT,
    "ocrConfidence" REAL,
    "inputSource" TEXT NOT NULL DEFAULT 'paste',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "assignedClinician" TEXT,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "signals" TEXT NOT NULL DEFAULT '[]',
    "signalEvidence" TEXT NOT NULL DEFAULT '[]',
    "structuredRecord" TEXT NOT NULL DEFAULT '{}',
    "explanation" TEXT NOT NULL,
    "analysisConfidence" INTEGER NOT NULL DEFAULT 72,
    "reviewState" TEXT NOT NULL DEFAULT 'medium_confidence',
    "pipelineTrace" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_idx" ON "PatientCase"("clerkUserId");
CREATE INDEX IF NOT EXISTS "PatientCase_guestSessionId_idx" ON "PatientCase"("guestSessionId");
CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_riskScore_idx" ON "PatientCase"("clerkUserId", "riskScore");
