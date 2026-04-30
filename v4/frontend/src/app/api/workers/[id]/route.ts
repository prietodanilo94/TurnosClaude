import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "jefe")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Jefe solo puede modificar workers de sus branches
  if (session.role === "jefe") {
    const worker = await prisma.worker.findUnique({
      where: { id: params.id },
      include: { branchTeam: { select: { branchId: true } } },
    });
    if (!worker || !session.branchIds?.includes(worker.branchTeam.branchId)) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  const { password, clearPassword } = await req.json();
  const data: { passwordHash: string | null } = { passwordHash: null };

  if (clearPassword) {
    data.passwordHash = null;
  } else if (password) {
    data.passwordHash = await bcrypt.hash(password, 12);
  } else {
    return NextResponse.json({ error: "password o clearPassword requerido" }, { status: 400 });
  }

  await prisma.worker.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}
