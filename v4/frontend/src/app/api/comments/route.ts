import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== "supervisor" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  if (!session.supervisorId) {
    return NextResponse.json({ error: "Sin supervisorId en sesión" }, { status: 400 });
  }
  const comments = await prisma.supervisorComment.findMany({
    where: { supervisorId: session.supervisorId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== "supervisor" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  }
  if (!session.supervisorId) {
    return NextResponse.json({ error: "Sin supervisorId en sesión" }, { status: 400 });
  }
  const { texto } = await req.json();
  if (!texto?.trim()) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }
  const comment = await prisma.supervisorComment.create({
    data: { supervisorId: session.supervisorId, texto: texto.trim() },
  });
  return NextResponse.json(comment, { status: 201 });
}
