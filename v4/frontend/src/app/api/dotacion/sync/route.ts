import { NextRequest, NextResponse } from "next/server";
import { parseDotacionExcel } from "@/lib/excel/parser";
import { prisma } from "@/lib/db/prisma";
import type { AreaNegocio } from "@/types";

function normalizeBranchName(raw: string): string {
  return raw
    .replace(/\bseminuevos\b/gi, "Usados")
    .replace(/\blocal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const { rows, errors } = parseDotacionExcel(buffer);

    let branchesCreated = 0;
    let branchesUpdated = 0;
    let workersUpserted = 0;
    let workersDeactivated = 0;

    // Agrupar por sucursal
    const byBranch = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.codigoBranch;
      if (!byBranch.has(key)) byBranch.set(key, []);
      byBranch.get(key)!.push(row);
    }

    // Upsert branches y teams
    for (const [codigo, branchRows] of byBranch) {
      const nombre = normalizeBranchName(branchRows[0].nombreBranch);

      const existing = await prisma.branch.findUnique({ where: { codigo } });
      const branch = await prisma.branch.upsert({
        where: { codigo },
        create: { codigo, nombre },
        update: { nombre },
      });

      if (existing) branchesUpdated++;
      else branchesCreated++;

      // Agrupar por área de negocio
      const byArea = new Map<AreaNegocio, typeof rows>();
      for (const row of branchRows) {
        if (!byArea.has(row.areaNegocio)) byArea.set(row.areaNegocio, []);
        byArea.get(row.areaNegocio)!.push(row);
      }

      for (const [areaNegocio, areaRows] of byArea) {
        const team = await prisma.branchTeam.upsert({
          where: { branchId_areaNegocio: { branchId: branch.id, areaNegocio } },
          create: { branchId: branch.id, areaNegocio },
          update: {},
        });

        // Upsert workers
        const incomingRuts = new Set<string>(areaRows.map((r) => r.rut));
        for (const row of areaRows) {
          await prisma.worker.upsert({
            where: { rut: row.rut },
            create: { rut: row.rut, nombre: row.nombre, branchTeamId: team.id },
            update: { nombre: row.nombre, branchTeamId: team.id, activo: true },
          });
          workersUpserted++;
        }

        // Desactivar vendedores que ya no están en el archivo (para este equipo)
        const toDeactivate = await prisma.worker.findMany({
          where: { branchTeamId: team.id, activo: true, rut: { notIn: [...incomingRuts] } },
        });
        if (toDeactivate.length > 0) {
          await prisma.worker.updateMany({
            where: { id: { in: toDeactivate.map((w) => w.id) } },
            data: { activo: false },
          });
          workersDeactivated += toDeactivate.length;
        }
      }
    }

    return NextResponse.json({ branchesCreated, branchesUpdated, workersUpserted, workersDeactivated, errors });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al sincronizar" },
      { status: 500 },
    );
  }
}
