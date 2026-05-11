import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { readGuestSessionId } from "@/lib/guest-session";
import { getPrisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth();
  const guestSessionId = userId ? null : readGuestSessionId(req);

  const prisma = getPrisma();
  const row = userId
    ? await prisma.patientCase.findFirst({ where: { id: params.id, clerkUserId: userId } })
    : await prisma.patientCase.findFirst({
        where: { id: params.id, guestSessionId: guestSessionId ?? "__none__" },
      });

  if (!row) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ case: row });
}
