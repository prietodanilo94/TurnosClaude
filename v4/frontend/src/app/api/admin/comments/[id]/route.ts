import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  const { adminRespuesta } = await req.json();
  const updated = await prisma.supervisorComment.update({
    where: { id: params.id },
    data: { adminRespuesta: adminRespuesta?.trim() || null },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  await prisma.supervisorComment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
