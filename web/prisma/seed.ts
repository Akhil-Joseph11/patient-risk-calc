import { DEMO_CASE_SEEDS } from "../src/lib/demo-cases";
import { persistAnalyzedCase } from "../src/lib/cases/persist-patient-case";
import { createPrismaClient } from "../src/lib/prisma-client-factory";

const prisma = createPrismaClient();

async function main() {
  const clerkUserId = process.env.SEED_CLERK_USER_ID?.trim();
  if (!clerkUserId) {
    console.log("Skipping seed: set SEED_CLERK_USER_ID to a Clerk user id.");
    return;
  }

  await prisma.patientCase.deleteMany({ where: { clerkUserId } });

  for (const d of DEMO_CASE_SEEDS) {
    await persistAnalyzedCase(prisma, {
      clerkUserId,
      patientName: d.patientName,
      age: d.age,
      clinicalNotes: d.clinicalNotes,
      rawDocumentText: d.rawDocumentText ?? d.clinicalNotes,
      ocrText: d.ocrText ?? null,
      ocrConfidence: d.ocrConfidence ?? null,
      inputSource: d.inputSource,
      tags: d.tags,
      assignedClinician: d.assignedClinician ?? null,
    });
  }

  console.log(`Seeded ${DEMO_CASE_SEEDS.length} cases for ${clerkUserId}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
