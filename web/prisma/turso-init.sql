-- Idempotent bootstrap for empty Turso DBs. Run: npm run db:apply-turso
CREATE TABLE IF NOT EXISTS "PatientCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "clinicalNotes" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "assignedClinician" TEXT,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "signals" TEXT NOT NULL DEFAULT '[]',
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_idx" ON "PatientCase"("clerkUserId");
CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_riskScore_idx" ON "PatientCase"("clerkUserId", "riskScore");
