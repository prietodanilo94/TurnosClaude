import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Solo el admin puede modificar grupos" }, { status: 403 });
  }

  const { nombre } = await req.json();
  if (!nombre?.trim()) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }

  const group = await prisma.branchGroup.update({
    where: { id: params.id },
    data: { nombre: nombre.trim() },
    include: { branches: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } } },
  });

  return NextResponse.json(group);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const supervisorId = session?.supervisorId ?? null;

  if (!isAdmin && !supervisorId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isAdmin && supervisorId) {
    const [groupBranches, supervisorBranches] = await Promise.all([
      prisma.branch.findMany({ where: { groupId: params.id }, select: { id: true } }),
      prisma.supervisorBranch.findMany({ where: { supervisorId }, select: { branchId: true } }),
    ]);
    const allowed = new Set(supervisorBranches.map((r) => r.branchId));
    if (groupBranches.some((b) => !allowed.has(b.id))) {
      return NextResponse.json({ error: "No tienes acceso a todas las sucursales del grupo" }, { status: 403 });
    }
  }

  await prisma.branch.updateMany({
    where: { groupId: params.id },
    data: { groupId: null },
  });

  await prisma.branchGroup.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
