import { NextRequest, NextResponse } from "next/server";
import { parseDotacionExcel } from "@/lib/excel/parser";
import { prisma } from "@/lib/db/prisma";
import type { AreaNegocio } from "@/types";
import { normalizeSupervisorName, supervisorLookupKey } from "@/lib/supervisors";
import { logAction } from "@/lib/audit/log";

function normalizeBranchName(raw: string): string {
  return raw
    .replace(/\busados\b/gi, "Seminuevos")
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
    let supervisorsCreated = 0;
    let supervisorLinksCreated = 0;

    const supervisors = await prisma.supervisor.findMany();
    const supervisorsByKey = new Map(
      supervisors.map((supervisor) => [supervisorLookupKey(supervisor.nombre), supervisor]),
    );

    const byBranch = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.codigoBranch;
      if (!byBranch.has(key)) byBranch.set(key, []);
      byBranch.get(key)?.push(row);
    }

    for (const [codigo, branchRows] of byBranch) {
      const nombre = normalizeBranchName(branchRows[0].nombreBranch);

      const existingBranch = await prisma.branch.findUnique({ where: { codigo } });
      const branch = await prisma.branch.upsert({
        where: { codigo },
        create: { codigo, nombre },
        update: { nombre },
      });

      if (existingBranch) branchesUpdated++;
      else branchesCreated++;

      const supervisorNames = Array.from(
        new Set(
          branchRows
            .map((row) => row.supervisor)
            .filter((value): value is string => !!value)
            .map((value) => normalizeSupervisorName(value)),
        ),
      );

      for (const supervisorName of supervisorNames) {
        const key = supervisorLookupKey(supervisorName);
        let supervisor = supervisorsByKey.get(key) ?? null;

        if (!supervisor) {
          supervisor = await prisma.supervisor.create({
            data: { nombre: supervisorName },
          });
          supervisorsByKey.set(key, supervisor);
          supervisorsCreated++;

          await logAction({
            action: "supervisor.create",
            entityType: "supervisor",
            entityId: supervisor.id,
            metadata: { nombre: supervisor.nombre, origen: "dotacion.sync" },
            req,
          });
        }

        const existingLink = await prisma.supervisorBranch.findUnique({
          where: {
            supervisorId_branchId: {
              supervisorId: supervisor.id,
              branchId: branch.id,
            },
          },
        });

        if (!existingLink) {
          await prisma.supervisorBranch.create({
            data: {
              supervisorId: supervisor.id,
              branchId: branch.id,
            },
          });
          supervisorLinksCreated++;

          await logAction({
            action: "supervisor.link",
            entityType: "supervisor",
            entityId: supervisor.id,
            branchId: branch.id,
            metadata: {
              supervisorNombre: supervisor.nombre,
              branchCodigo: branch.codigo,
              branchNombre: branch.nombre,
              origen: "dotacion.sync",
            },
            req,
          });
        }
      }

      const byArea = new Map<AreaNegocio, typeof rows>();
      for (const row of branchRows) {
        if (!byArea.has(row.areaNegocio)) byArea.set(row.areaNegocio, []);
        byArea.get(row.areaNegocio)?.push(row);
      }

      for (const [areaNegocio, areaRows] of byArea) {
        const team = await prisma.branchTeam.upsert({
          where: { branchId_areaNegocio: { branchId: branch.id, areaNegocio } },
          create: { branchId: branch.id, areaNegocio },
          update: {},
        });

        const incomingRuts = new Set<string>(areaRows.map((row) => row.rut));
        for (const row of areaRows) {
          await prisma.worker.upsert({
            where: { rut: row.rut },
            create: {
              rut: row.rut,
              nombre: row.nombre,
              branchTeamId: team.id,
            },
            update: {
              nombre: row.nombre,
              branchTeamId: team.id,
              activo: true,
            },
          });
          workersUpserted++;
        }

        const toDeactivate = await prisma.worker.findMany({
          where: {
            branchTeamId: team.id,
            activo: true,
            rut: { notIn: [...incomingRuts] },
          },
        });

        if (toDeactivate.length > 0) {
          await prisma.worker.updateMany({
            where: { id: { in: toDeactivate.map((worker) => worker.id) } },
            data: { activo: false },
          });
          workersDeactivated += toDeactivate.length;
        }
      }
    }

    await logAction({
      action: "dotacion.sync",
      entityType: "branch",
      metadata: {
        branchesCreated,
        branchesUpdated,
        workersUpserted,
        workersDeactivated,
        supervisorsCreated,
        supervisorLinksCreated,
        errorCount: errors.length,
      },
      req,
    });

    return NextResponse.json({
      branchesCreated,
      branchesUpdated,
      workersUpserted,
      workersDeactivated,
      supervisorsCreated,
      supervisorLinksCreated,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al sincronizar" },
      { status: 500 },
    );
  }
}
