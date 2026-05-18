import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  const comments = await prisma.supervisorComment.findMany({
    include: { supervisor: { select: { nombre: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(comments);
}
