import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || !session.supervisorId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const pattern = await prisma.shiftPattern.findUnique({ where: { id: params.id } });
  if (!pattern) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (pattern.supervisorId !== session.supervisorId) {
    return NextResponse.json({ error: "No puedes eliminar horarios de otros supervisores" }, { status: 403 });
  }

  await prisma.shiftPattern.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
