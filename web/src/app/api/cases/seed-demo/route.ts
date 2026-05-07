import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { runRiskAnalysis } from "@/lib/run-analysis";

const demoCases = [
  {
    patientName: "Aisha Khan",
    age: 49,
    clinicalNotes:
      "Reports nausea and abdominal pain for 1 week; eating about half usual meals.",
    tags: JSON.stringify(["GI", "nutrition"]),
    assignedClinician: undefined as string | undefined,
  },
  {
    patientName: "Robert Vega",
    age: 76,
    clinicalNotes: "Shortness of breath on exertion, mild fatigue. Weight stable.",
    tags: JSON.stringify(["cardiopulmonary"]),
    assignedClinician: "Dr. Alvarez",
  },
  {
    patientName: "Elena Popov",
    age: 81,
    clinicalNotes: "Family notes confusion overnight; poor oral intake last 48h.",
    tags: JSON.stringify(["AMS", "geriatrics"]),
    assignedClinician: "Dr. Kim",
  },
];

/** Seeds demo patient cases for the signed-in user (portfolio convenience). */
export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getPrisma().patientCase.count({ where: { clerkUserId: userId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Cases already exist; demo seed skipped." }, { status: 409 });
  }

  try {
    for (const d of demoCases) {
      const analysis = await runRiskAnalysis(d.clinicalNotes);
      await getPrisma().patientCase.create({
        data: {
          clerkUserId: userId,
          patientName: d.patientName,
          age: d.age,
          clinicalNotes: d.clinicalNotes,
          tags: d.tags,
          assignedClinician: d.assignedClinician ?? null,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          signals: JSON.stringify(analysis.signals),
          explanation: analysis.explanation,
        },
      });
    }
    return NextResponse.json({ ok: true, count: demoCases.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
