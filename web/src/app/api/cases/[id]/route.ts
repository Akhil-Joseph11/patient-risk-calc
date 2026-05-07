import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await getPrisma().patientCase.findFirst({
    where: { id: params.id, clerkUserId: userId },
  });
  if (!row) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ case: row });
}
