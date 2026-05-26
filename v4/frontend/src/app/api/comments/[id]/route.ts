import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== "supervisor" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  const comment = await prisma.supervisorComment.findUnique({ where: { id: params.id } });
  if (!comment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (session.role !== "admin" && comment.supervisorId !== session.supervisorId) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 403 });
  }
  await prisma.supervisorComment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
