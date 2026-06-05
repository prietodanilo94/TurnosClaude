import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    nombre?: string;
    codigo?: string;
    areaNegocio?: string;
    categoria?: string | null;
  };

  const nombre = body.nombre?.trim();
  const codigo = body.codigo?.trim();
  const areaNegocio = body.areaNegocio;
  const categoria = body.categoria || null;

  if (!nombre || !codigo) {
    return NextResponse.json({ error: "Nombre y código son obligatorios" }, { status: 400 });
  }
  if (areaNegocio !== "ventas" && areaNegocio !== "postventa") {
    return NextResponse.json({ error: "Área de negocio inválida" }, { status: 400 });
  }

  const existing = await prisma.branch.findUnique({ where: { codigo } });
  if (existing) {
    return NextResponse.json({ error: `El código ${codigo} ya existe (${existing.nombre})` }, { status: 409 });
  }

  if (categoria) {
    const pattern = await prisma.shiftPattern.findUnique({ where: { id: categoria } });
    if (!pattern) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 400 });
    }
    if (pattern.areaNegocio !== areaNegocio) {
      return NextResponse.json({ error: "La categoría no corresponde al área de negocio" }, { status: 400 });
    }
  }

  const branch = await prisma.branch.create({
    data: {
      nombre,
      codigo,
      teams: {
        create: {
          areaNegocio,
          categoria,
          categoriaSetAt: categoria ? new Date() : null,
        },
      },
    },
    include: { teams: { select: { id: true } } },
  });

  await logAction({
    action: "branch.create",
    entityType: "branch",
    entityId: branch.id,
    branchId: branch.id,
    metadata: { nombre, codigo, areaNegocio, categoria },
    req,
  });

  return NextResponse.json({ id: branch.id, teamId: branch.teams[0]?.id ?? null });
}
