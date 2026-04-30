import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") return false;
  return true;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: { branches: { include: { branch: { select: { id: true, nombre: true, codigo: true } } } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const { email, nombre, password, branchIds } = await req.json();
  if (!email || !nombre || !password) {
    return NextResponse.json({ error: "email, nombre y password son requeridos" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      nombre,
      passwordHash,
      branches: {
        create: (branchIds ?? []).map((id: string) => ({ branchId: id })),
      },
    },
    include: { branches: { include: { branch: { select: { id: true, nombre: true, codigo: true } } } } },
  });
  return NextResponse.json(user, { status: 201 });
}
