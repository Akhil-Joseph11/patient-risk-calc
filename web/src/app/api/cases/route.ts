import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { runRiskAnalysis } from "@/lib/run-analysis";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cases = await getPrisma().patientCase.findMany({
    where: { clerkUserId: userId },
    orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const patientName = String(body.patientName ?? "").trim();
    const age = Number(body.age);
    const clinicalNotes = String(body.clinicalNotes ?? "").trim();
    const tagsRaw = body.tags;
    const assignedClinician =
      body.assignedClinician != null ? String(body.assignedClinician).trim() || null : null;

    if (!patientName || !clinicalNotes || !Number.isFinite(age) || age < 0 || age > 130) {
      return NextResponse.json({ error: "Invalid patient case payload" }, { status: 400 });
    }

    let tagsJson = "[]";
    if (Array.isArray(tagsRaw)) {
      tagsJson = JSON.stringify(tagsRaw.map((t: unknown) => String(t).trim()).filter(Boolean));
    } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      tagsJson = JSON.stringify(
        tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }

    const analysis = await runRiskAnalysis(clinicalNotes);

    const created = await getPrisma().patientCase.create({
      data: {
        clerkUserId: userId,
        patientName,
        age: Math.round(age),
        clinicalNotes,
        tags: tagsJson,
        assignedClinician,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        signals: JSON.stringify(analysis.signals),
        explanation: analysis.explanation,
      },
    });

    return NextResponse.json({ case: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create care case" }, { status: 500 });
  }
}
