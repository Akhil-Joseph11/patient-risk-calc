import { createPrismaClient } from "../src/lib/prisma-client-factory";

const prisma = createPrismaClient();

async function main() {
  const clerkUserId = process.env.SEED_CLERK_USER_ID?.trim();
  if (!clerkUserId) {
    console.log("Skipping prisma seed: set SEED_CLERK_USER_ID to your Clerk user id.");
    return;
  }

  const samples = [
    {
      patientName: "Maria Chen",
      age: 72,
      clinicalNotes:
        "Patient has lost 8kg in 2 months, poor appetite, fatigue. Denies fever.",
      tags: JSON.stringify(["nutrition", "follow-up"]),
      assignedClinician: "Dr. Patel",
      riskScore: 88,
      riskLevel: "High",
      signals: JSON.stringify([
        "Significant unintentional weight loss",
        "Poor or reduced appetite",
        "Fatigue or weakness",
      ]),
      explanation:
        "Multiple nutritional and functional decline signals warrant prioritized assessment and monitoring.",
    },
    {
      patientName: "James O'Neil",
      age: 64,
      clinicalNotes:
        "Stable weight, normal intake, recovering well after elective procedure.",
      tags: JSON.stringify(["post-op"]),
      assignedClinician: "Dr. Patel",
      riskScore: 28,
      riskLevel: "Low",
      signals: JSON.stringify(["Stable nutrition and recovery (protective)"]),
      explanation:
        "Note emphasizes stability and adequate intake—lower prioritization relative to symptomatic cases.",
    },
    {
      patientName: "Linda Wu",
      age: 58,
      clinicalNotes: "Febrile to 38.6, decreased PO intake, weakness.",
      tags: JSON.stringify(["acute"]),
      assignedClinician: undefined,
      riskScore: 92,
      riskLevel: "High",
      signals: JSON.stringify([
        "Fever or infection concern",
        "Poor or reduced appetite",
        "Fatigue or weakness",
      ]),
      explanation:
        "Acute infectious symptoms with intake decline suggest urgent evaluation.",
    },
    {
      patientName: "Diego Morales",
      age: 69,
      clinicalNotes:
        "Chronic issues stable; occasional tiredness but weight unchanged and meals regular.",
      tags: JSON.stringify(["chronic"]),
      assignedClinician: "Dr. Kim",
      riskScore: 42,
      riskLevel: "Low",
      signals: JSON.stringify(["Fatigue or weakness"]),
      explanation:
        "Mild fatigue without weight loss or intake compromise—routine monitoring.",
    },
  ];

  await prisma.patientCase.deleteMany({ where: { clerkUserId } });
  for (const row of samples) {
    await prisma.patientCase.create({
      data: { clerkUserId, ...row },
    });
  }
  console.log(`Seeded ${samples.length} patient cases for ${clerkUserId}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
