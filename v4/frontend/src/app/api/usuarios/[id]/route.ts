import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const { email, nombre, password, branchIds, activo } = await req.json();

  const data: Record<string, unknown> = {};
  if (email !== undefined) data.email = email.toLowerCase();
  if (nombre !== undefined) data.nombre = nombre;
  if (activo !== undefined) data.activo = activo;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  // Actualizar sucursales si se envían
  if (branchIds !== undefined) {
    await prisma.userBranch.deleteMany({ where: { userId: params.id } });
    await prisma.userBranch.createMany({
      data: (branchIds as string[]).map((branchId) => ({ userId: params.id, branchId })),
    });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    include: { branches: { include: { branch: { select: { id: true, nombre: true, codigo: true } } } } },
  });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
