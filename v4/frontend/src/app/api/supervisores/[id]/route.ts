import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit/log";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { nombre, email, password, resetPassword, branchIds, activo } = await req.json();
  const current = await prisma.supervisor.findUnique({
    where: { id: params.id },
    include: {
      branches: {
        include: {
          branch: { select: { id: true, nombre: true, codigo: true } },
        },
      },
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Supervisor no encontrado" }, { status: 404 });
  }

  const normalizedEmail = email === undefined ? undefined : email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail) {
    const existing = await prisma.supervisor.findUnique({ where: { email: normalizedEmail } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (nombre !== undefined) data.nombre = String(nombre).trim();
  if (normalizedEmail !== undefined) data.email = normalizedEmail;
  if (activo !== undefined) data.activo = activo;
  if (resetPassword) data.passwordHash = null;
  else if (password) data.passwordHash = await bcrypt.hash(password, 12);

  if (branchIds !== undefined) {
    await prisma.supervisorBranch.deleteMany({ where: { supervisorId: params.id } });
    await prisma.supervisorBranch.createMany({
      data: (branchIds as string[]).map((branchId) => ({ supervisorId: params.id, branchId })),
    });

    const prevIds = new Set(current.branches.map((branch) => branch.branch.id));
    const nextIds = new Set((branchIds as string[]) ?? []);
    for (const branchId of nextIds) {
      if (prevIds.has(branchId)) continue;
      const branch = current.branches.find((item) => item.branch.id === branchId)
        ?? {
          branch: await prisma.branch.findUniqueOrThrow({
            where: { id: branchId },
            select: { id: true, nombre: true, codigo: true },
          }),
        };

      await logAction({
        action: "supervisor.link",
        entityType: "supervisor",
        entityId: params.id,
        branchId,
        metadata: {
          supervisorNombre: nombre ?? current.nombre,
          branchNombre: branch.branch.nombre,
          branchCodigo: branch.branch.codigo,
          origen: "admin",
        },
        req,
      });
    }
  }

  const supervisor = await prisma.supervisor.update({
    where: { id: params.id },
    data,
    include: {
      branches: {
        include: {
          branch: { select: { id: true, nombre: true, codigo: true } },
        },
      },
    },
  });

  return NextResponse.json(supervisor);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  await prisma.supervisor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
