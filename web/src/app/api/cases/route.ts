import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { persistAnalyzedCase } from "@/lib/cases/persist-patient-case";
import {
  ensureGuestCookieOnResponse,
  newGuestSessionId,
  readGuestSessionId,
} from "@/lib/guest-session";
import { getPrisma } from "@/lib/db";

function ownerWhere(userId: string | null, guestSessionId: string | null) {
  if (userId) return { clerkUserId: userId };
  if (guestSessionId) return { guestSessionId };
  return null;
}

export async function GET(req: Request) {
  const { userId } = auth();
  const existingGuest = readGuestSessionId(req);
  const guestSessionId = userId ? null : existingGuest ?? newGuestSessionId();

  const where = ownerWhere(userId, guestSessionId);
  if (!where) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  const prisma = getPrisma();

  const cases = await prisma.patientCase.findMany({
    where,
    orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
  });

  const res = NextResponse.json({ cases, guest: !userId });
  if (!userId && !existingGuest && guestSessionId) {
    ensureGuestCookieOnResponse(res, guestSessionId);
  }
  return res;
}

export async function POST(req: Request) {
  const { userId } = auth();
  const existingGuest = readGuestSessionId(req);
  const guestSessionId = userId ? null : existingGuest ?? newGuestSessionId();

  if (!userId && !guestSessionId) {
    return NextResponse.json({ error: "Missing guest session" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const patientName = String(body.patientName ?? "").trim();
    const age = Number(body.age);
    const clinicalNotes = String(body.clinicalNotes ?? "").trim();
    const rawDocumentText =
      body.rawDocumentText != null ? String(body.rawDocumentText).trim() : clinicalNotes;
    const ocrText = body.ocrText != null ? String(body.ocrText).trim() : null;
    const ocrConfidenceRaw = body.ocrConfidence;
    const ocrConfidence =
      ocrConfidenceRaw === null || ocrConfidenceRaw === undefined || ocrConfidenceRaw === ""
        ? null
        : Number(ocrConfidenceRaw);
    const inputSource = (String(body.inputSource ?? "paste").toLowerCase() as "paste" | "image" | "pdf") || "paste";

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

    const prisma = getPrisma();
    const created = await persistAnalyzedCase(prisma, {
      clerkUserId: userId ?? null,
      guestSessionId: guestSessionId ?? null,
      patientName,
      age: Math.round(age),
      clinicalNotes,
      rawDocumentText,
      ocrText: ocrText || null,
      ocrConfidence:
        ocrConfidence != null && Number.isFinite(ocrConfidence) ? Math.max(0, Math.min(1, ocrConfidence)) : null,
      inputSource: inputSource === "image" || inputSource === "pdf" ? inputSource : "paste",
      tags: JSON.parse(tagsJson) as string[],
      assignedClinician,
    });

    const res = NextResponse.json({ case: created }, { status: 201 });
    if (!userId && !existingGuest && guestSessionId) {
      ensureGuestCookieOnResponse(res, guestSessionId);
    }
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create care case" }, { status: 500 });
  }
}
