import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit/log";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const supervisors = await prisma.supervisor.findMany({
    include: {
      branches: {
        include: {
          branch: { select: { id: true, nombre: true, codigo: true } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(supervisors);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { nombre, email, password, branchIds } = await req.json();
  if (!nombre) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }

  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail) {
    const existing = await prisma.supervisor.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
  }

  const supervisor = await prisma.supervisor.create({
    data: {
      nombre: String(nombre).trim(),
      email: normalizedEmail,
      passwordHash: password ? await bcrypt.hash(password, 12) : null,
      branches: {
        create: (branchIds ?? []).map((branchId: string) => ({ branchId })),
      },
    },
    include: {
      branches: {
        include: {
          branch: { select: { id: true, nombre: true, codigo: true } },
        },
      },
    },
  });

  await logAction({
    action: "supervisor.create",
    entityType: "supervisor",
    entityId: supervisor.id,
    metadata: {
      nombre: supervisor.nombre,
      email: supervisor.email,
      branchCount: supervisor.branches.length,
      origen: "admin",
    },
    req,
  });

  for (const relation of supervisor.branches) {
    await logAction({
      action: "supervisor.link",
      entityType: "supervisor",
      entityId: supervisor.id,
      branchId: relation.branch.id,
      metadata: {
        supervisorNombre: supervisor.nombre,
        branchNombre: relation.branch.nombre,
        branchCodigo: relation.branch.codigo,
        origen: "admin",
      },
      req,
    });
  }

  return NextResponse.json(supervisor, { status: 201 });
}
