import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

async function getSessionOrFail() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "supervisor")) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await getSessionOrFail();
  if (!session) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  // Admin ve todos; supervisor ve solo los grupos de sus sucursales
  const allowedBranchIds =
    session.role === "admin"
      ? undefined
      : session.supervisorId
        ? (await prisma.supervisorBranch.findMany({
            where: { supervisorId: session.supervisorId },
            select: { branchId: true },
          })).map((r) => r.branchId)
        : (session.branchIds ?? []);

  const groups = await prisma.branchGroup.findMany({
    where: allowedBranchIds
      ? { branches: { some: { id: { in: allowedBranchIds } } } }
      : undefined,
    include: { branches: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } } },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrFail();
  if (!session) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const { branchIds, nombre } = await req.json();
  if (!Array.isArray(branchIds) || branchIds.length < 2) {
    return NextResponse.json({ error: "Se requieren al menos 2 sucursales" }, { status: 400 });
  }

  // Verificar que el supervisor tenga acceso a todas las sucursales solicitadas
  if (session.role !== "admin") {
    const allowedBranchIds =
      session.supervisorId
        ? (await prisma.supervisorBranch.findMany({
            where: { supervisorId: session.supervisorId },
            select: { branchId: true },
          })).map((r) => r.branchId)
        : (session.branchIds ?? []);

    const unauthorized = branchIds.filter((id: string) => !allowedBranchIds.includes(id));
    if (unauthorized.length > 0) {
      return NextResponse.json({ error: "Sin acceso a algunas sucursales" }, { status: 403 });
    }
  }

  // Verificar que ninguna sucursal ya pertenezca a un grupo
  const alreadyGrouped = await prisma.branch.findMany({
    where: { id: { in: branchIds }, groupId: { not: null } },
    select: { nombre: true },
  });
  if (alreadyGrouped.length > 0) {
    return NextResponse.json(
      { error: `Sucursales ya en un grupo: ${alreadyGrouped.map((b) => b.nombre).join(", ")}` },
      { status: 409 },
    );
  }

  // Generar nombre automático si no viene uno
  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    orderBy: { nombre: "asc" },
    select: { nombre: true },
  });
  const groupNombre = nombre?.trim() || branches.map((b) => b.nombre).join(" - ");

  const group = await prisma.branchGroup.create({
    data: {
      nombre: groupNombre,
      branches: { connect: branchIds.map((id: string) => ({ id })) },
    },
    include: { branches: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } } },
  });

  return NextResponse.json(group, { status: 201 });
}
