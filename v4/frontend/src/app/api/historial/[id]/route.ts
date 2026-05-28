import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  const { visto } = await req.json();
  const log = await prisma.auditLog.update({
    where: { id: params.id },
    data: { visto: Boolean(visto) },
    select: { id: true, visto: true },
  });
  return NextResponse.json(log);
}
