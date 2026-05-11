import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { DEMO_CASE_SEEDS } from "@/lib/demo-cases";
import { persistAnalyzedCase } from "@/lib/cases/persist-patient-case";
import { ensureGuestCookieOnResponse, newGuestSessionId, readGuestSessionId } from "@/lib/guest-session";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = auth();
  const existingGuest = readGuestSessionId(req);
  const guestSessionId = userId ? null : existingGuest ?? newGuestSessionId();

  if (!userId && !guestSessionId) {
    return NextResponse.json({ error: "Missing guest session" }, { status: 400 });
  }

  const prisma = getPrisma();
  const where = userId ? { clerkUserId: userId } : { guestSessionId: guestSessionId! };

  const existing = await prisma.patientCase.count({ where });
  if (existing > 0) {
    return NextResponse.json(
      { error: userId ? "Workspace already has cases." : "Sample cases already exist for this session." },
      { status: 409 }
    );
  }

  try {
    for (const d of DEMO_CASE_SEEDS) {
      await persistAnalyzedCase(prisma, {
        clerkUserId: userId ?? null,
        guestSessionId: guestSessionId ?? null,
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
    const res = NextResponse.json({ ok: true, count: DEMO_CASE_SEEDS.length });
    if (!userId && !existingGuest && guestSessionId) {
      ensureGuestCookieOnResponse(res, guestSessionId);
    }
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
