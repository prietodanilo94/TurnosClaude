import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAllPatterns } from "@/lib/patterns/catalog";

const VALID_CATS = new Set(getAllPatterns().map((p) => p.id));

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { categoria } = await req.json();

  if (!VALID_CATS.has(categoria)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const team = await prisma.branchTeam.update({
    where: { id: params.id },
    data: { categoria, categoriaSetAt: new Date() },
  });

  return NextResponse.json({ ok: true, categoria: team.categoria });
}
