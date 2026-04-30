import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

function normalizeBranchName(raw: string): string {
  return raw
    .replace(/\bseminuevos\b/gi, "Usados")
    .replace(/\blocal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST() {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const branches = await prisma.branch.findMany({ select: { id: true, nombre: true } });
  let updated = 0;
  for (const b of branches) {
    const normalized = normalizeBranchName(b.nombre);
    if (normalized !== b.nombre) {
      await prisma.branch.update({ where: { id: b.id }, data: { nombre: normalized } });
      updated++;
    }
  }
  return NextResponse.json({ updated });
}
