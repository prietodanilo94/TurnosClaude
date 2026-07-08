import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { logAction } from "@/lib/audit/log";
import { rrhhRowsFromTeam, buildRrhhWorkbookBufferSheets, safeFileName } from "@/lib/excel/rrhhSheet";
import type { CalendarSlot } from "@/types";

// F10 — descarga selectiva de filas de la tabla Exportar/Historial. Recibe
// claves `${auditLogId}:${workerId}`, regenera el Excel RRHH desde el
// Calendar ACTUAL de cada trabajador (no desde el metadata del log guardado
// en su momento) y marca cada fila cubierta con un ChangeExportRecord.
// Ver v4/specs/F10-exportar-historial-unificado/spec.md.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { keys } = await req.json();
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "Faltan claves a exportar" }, { status: 400 });
  }

  const parsed = (keys as unknown[])
    .filter((k): k is string => typeof k === "string" && k.includes(":"))
    .map((k) => {
      const idx = k.indexOf(":");
      return { auditLogId: k.slice(0, idx), workerId: k.slice(idx + 1) };
    });
  if (parsed.length === 0) {
    return NextResponse.json({ error: "Claves inválidas" }, { status: 400 });
  }

  const auditLogIds = [...new Set(parsed.map((p) => p.auditLogId))];
  const logs = await prisma.auditLog.findMany({
    where: { id: { in: auditLogIds }, action: "calendar.save" },
    select: { id: true, metadata: true },
  });
  const logYearMonth = new Map<string, { year: number; month: number }>();
  for (const log of logs) {
    if (!log.metadata) continue;
    try {
      const meta = JSON.parse(log.metadata) as { year?: number; month?: number };
      if (meta.year && meta.month) logYearMonth.set(log.id, { year: meta.year, month: meta.month });
    } catch { /* metadata malformado */ }
  }

  const workerIds = [...new Set(parsed.map((p) => p.workerId))];
  const workers = await prisma.worker.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, rut: true, branchTeamId: true },
  });
  const workerById = new Map(workers.map((w) => [w.id, w]));

  // Agrupa por (branchTeamId, year, month) para traer una sola vez cada
  // Calendar vigente — un mismo equipo/mes puede cubrir varias claves.
  interface Bucket { branchTeamId: string; year: number; month: number; workerIds: Set<string> }
  const buckets = new Map<string, Bucket>();

  for (const p of parsed) {
    const ym = logYearMonth.get(p.auditLogId);
    const w = workerById.get(p.workerId);
    if (!ym || !w) continue;
    const bucketKey = `${w.branchTeamId}:${ym.year}:${ym.month}`;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { branchTeamId: w.branchTeamId, year: ym.year, month: ym.month, workerIds: new Set() });
    }
    buckets.get(bucketKey)!.workerIds.add(p.workerId);
  }

  if (buckets.size === 0) {
    return NextResponse.json({ error: "No se pudo resolver ninguno de los cambios seleccionados" }, { status: 404 });
  }

  const calendars = await prisma.calendar.findMany({
    where: { OR: [...buckets.values()].map((b) => ({ branchTeamId: b.branchTeamId, year: b.year, month: b.month })) },
    select: { branchTeamId: true, year: true, month: true, slotsData: true, assignments: true },
  });
  const calendarByKey = new Map(calendars.map((c) => [`${c.branchTeamId}:${c.year}:${c.month}`, c]));
  const rutById = new Map(workers.map((w) => [w.id, w.rut]));

  const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  // Una hoja por mes: seleccionar cambios de meses distintos ya no los mezcla
  // en una sola tabla (incidente carga masiva 2026-07-07).
  const rowsByMonth = new Map<string, (string | number)[][]>();
  const allRows: (string | number)[][] = [];
  const exportedWorkerIdsByBucket = new Map<string, Set<string>>();

  for (const [bucketKey, bucket] of buckets) {
    const cal = calendarByKey.get(bucketKey);
    if (!cal) continue;

    const slots: CalendarSlot[] = JSON.parse(cal.slotsData);
    const assignments: Record<string, string | null> = JSON.parse(cal.assignments);
    const workerRutMap: Record<string, string> = {};
    for (const wid of bucket.workerIds) {
      const rut = rutById.get(wid);
      if (rut) workerRutMap[wid] = rut;
    }

    const teamRows = rrhhRowsFromTeam(bucket.year, bucket.month, slots, assignments, workerRutMap, bucket.workerIds);
    allRows.push(...teamRows);
    const mk = `${MESES[bucket.month]} ${bucket.year}`;
    if (!rowsByMonth.has(mk)) rowsByMonth.set(mk, []);
    rowsByMonth.get(mk)!.push(...teamRows);

    const assignedSet = new Set(Object.values(assignments).filter((v): v is string => !!v));
    exportedWorkerIdsByBucket.set(bucketKey, new Set([...bucket.workerIds].filter((wid) => assignedSet.has(wid))));
  }

  if (allRows.length === 0) {
    return NextResponse.json({ error: "Ninguno de los trabajadores seleccionados tiene calendario vigente" }, { status: 404 });
  }

  // Cubiertas = las claves cuyo trabajador efectivamente quedo en el Excel
  const covered: { auditLogId: string; workerId: string }[] = [];
  for (const p of parsed) {
    const ym = logYearMonth.get(p.auditLogId);
    const w = workerById.get(p.workerId);
    if (!ym || !w) continue;
    const bucketKey = `${w.branchTeamId}:${ym.year}:${ym.month}`;
    if (exportedWorkerIdsByBucket.get(bucketKey)?.has(p.workerId)) {
      covered.push({ auditLogId: p.auditLogId, workerId: p.workerId });
    }
  }

  const now = new Date();
  const exportedBy = session.email;

  if (covered.length > 0) {
    await prisma.changeExportRecord.createMany({
      data: covered.map((c) => ({ auditLogId: c.auditLogId, workerId: c.workerId, exportedBy, exportedAt: now })),
    });
  }

  await logAction({
    action: "calendar.export",
    entityType: "calendar",
    entityId: null,
    branchId: null,
    metadata: {
      mode: "seleccion_rrhh",
      requested: parsed.length,
      covered: covered.length,
    },
    req,
  });

  const buf = buildRrhhWorkbookBufferSheets([...rowsByMonth.entries()].map(([name, rows]) => ({ name, rows })));
  const fileName = safeFileName(`turnos_rrhh_seleccion_${now.toISOString().slice(0, 10)}`) + ".xlsx";

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
