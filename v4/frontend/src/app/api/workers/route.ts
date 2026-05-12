import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin";
}

function normalizeRut(raw: string): string | null {
  const clean = raw.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  return `${body}-${dv}`;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const workers = await prisma.worker.findMany({
    include: {
      branchTeam: {
        include: { branch: { select: { id: true, nombre: true, codigo: true } } },
      },
    },
    orderBy: [{ branchTeam: { branch: { nombre: "asc" } } }, { nombre: "asc" }],
  });

  return NextResponse.json(workers);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { rut, nombre, branchTeamId } = await req.json();
  if (!rut || !nombre || !branchTeamId) {
    return NextResponse.json({ error: "rut, nombre y branchTeamId son requeridos" }, { status: 400 });
  }

  const normalizedRut = normalizeRut(String(rut));
  if (!normalizedRut) {
    return NextResponse.json({ error: "RUT invalido" }, { status: 400 });
  }

  const existing = await prisma.worker.findUnique({ where: { rut: normalizedRut } });
  if (existing) {
    return NextResponse.json({ error: "RUT ya registrado" }, { status: 409 });
  }

  const worker = await prisma.worker.create({
    data: {
      rut: normalizedRut,
      nombre: String(nombre).trim(),
      branchTeamId: String(branchTeamId),
    },
    include: {
      branchTeam: {
        include: { branch: { select: { id: true, nombre: true, codigo: true } } },
      },
    },
  });

  return NextResponse.json(worker, { status: 201 });
}
