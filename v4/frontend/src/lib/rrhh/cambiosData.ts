// F10 — construye las filas de la tabla unificada Exportar/Historial a partir
// de los AuditLog de tipo "calendar.save". Cada fila = un trabajador dentro
// de un guardado especifico (auditLogId + workerId). Logica pura y testeable,
// sin acceso a Prisma: page.tsx hace las queries y le pasa los datos crudos.
// Ver v4/specs/F10-exportar-historial-unificado/spec.md ("Guia de implementacion").

export interface CambioDetalle {
  date: string;
  dayLabel: string;
  from: string | null;
  to: string | null;
}

export interface CambioRow {
  key: string; // `${auditLogId}:${workerId}`
  auditLogId: string;
  area: string;
  sucursal: string;
  codigo: string;
  fechaMod: string; // ISO
  modificadoPor: string;
  workerId: string;
  trabajador: string;
  eventos: number;
  cambios: CambioDetalle[];
  fechaDescarga: string | null;
  descargadoPor: string | null;
}

export interface RawAuditLogInput {
  id: string;
  createdAt: Date;
  userEmail: string | null;
  metadata: string | null;
}

export interface WorkerInfoInput {
  areaNegocio: string;
  branchNombre: string;
  branchCodigo: string;
}

export interface ExportRecordInput {
  auditLogId: string;
  workerId: string;
  exportedAt: Date;
  exportedBy: string;
}

interface RawChange {
  workerId: string;
  workerName: string;
  date: string;
  dayLabel: string;
  from: string | null;
  to: string | null;
}

// Se queda con el registro de descarga mas reciente por (auditLogId, workerId).
function buildLatestExportMap(records: ExportRecordInput[]): Map<string, ExportRecordInput> {
  const map = new Map<string, ExportRecordInput>();
  for (const rec of records) {
    const key = `${rec.auditLogId}:${rec.workerId}`;
    const current = map.get(key);
    if (!current || rec.exportedAt > current.exportedAt) map.set(key, rec);
  }
  return map;
}

function canonicalCambios(cambios: CambioDetalle[]): string {
  return [...cambios]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => `${c.date}|${c.from ?? ""}|${c.to ?? ""}`)
    .join(";");
}

// Colapsa guardados con contenido IDENTICO para el mismo trabajador (mismos
// dias, mismos horarios) en una sola fila. Esto pasaba cuando un supervisor
// guardaba dos veces en la misma sesion sin cambios nuevos: un bug en
// CalendarView.tsx/SupervisorCalendarView.tsx recalculaba el diff contra el
// estado con el que se abrio la pagina en vez del ultimo guardado, y
// duplicaba el mismo cambio en el AuditLog (corregido, pero deja historial
// duplicado). Se conserva el guardado mas reciente; si CUALQUIERA de los
// duplicados ya fue descargado, la fila resultante se marca como descargada.
// Riesgo aceptado: dos ediciones genuinas y separadas en el tiempo que
// coincidan exactamente en todos sus dias/horarios se verian como una sola
// fila — se considera poco probable frente al beneficio de no mostrar
// guardados repetidos como si fueran cambios distintos.
function dedupeIdenticalSaves(rows: CambioRow[]): CambioRow[] {
  const groups = new Map<string, CambioRow[]>();
  for (const row of rows) {
    const groupKey = `${row.workerId}::${canonicalCambios(row.cambios)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(row);
  }

  const result: CambioRow[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const latest = group.reduce((a, b) => (b.fechaMod > a.fechaMod ? b : a));
    const bestDownload = group
      .filter((r) => r.fechaDescarga)
      .reduce<CambioRow | null>((best, r) => (!best || r.fechaDescarga! > best.fechaDescarga!) ? r : best, null);

    result.push({
      ...latest,
      fechaDescarga: bestDownload?.fechaDescarga ?? null,
      descargadoPor: bestDownload?.descargadoPor ?? null,
    });
  }
  return result;
}

// Primera pasada sobre los logs crudos: solo junta los workerId referenciados
// para poder resolver su sucursal/area actual antes de construir las filas.
export function extractWorkerIdsFromLogs(logs: RawAuditLogInput[]): Set<string> {
  const ids = new Set<string>();
  for (const log of logs) {
    if (!log.metadata) continue;
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(log.metadata);
    } catch {
      continue;
    }
    if (!Array.isArray(meta.changes)) continue;
    for (const c of meta.changes as RawChange[]) {
      if (typeof c?.workerId === "string" && c.workerId) ids.add(c.workerId);
    }
  }
  return ids;
}

export function buildCambioRows(
  logs: RawAuditLogInput[],
  workerInfoMap: Map<string, WorkerInfoInput>,
  exportRecords: ExportRecordInput[],
): CambioRow[] {
  const latestExportByKey = buildLatestExportMap(exportRecords);
  const rows: CambioRow[] = [];

  for (const log of logs) {
    if (!log.metadata) continue;
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(log.metadata);
    } catch {
      continue;
    }

    const rawChanges = Array.isArray(meta.changes)
      ? (meta.changes as RawChange[]).filter((c) => typeof c?.workerId === "string" && c.workerId)
      : [];
    if (rawChanges.length === 0) continue;

    const byWorker = new Map<string, RawChange[]>();
    for (const c of rawChanges) {
      if (!byWorker.has(c.workerId)) byWorker.set(c.workerId, []);
      byWorker.get(c.workerId)!.push(c);
    }

    for (const [workerId, workerChanges] of byWorker) {
      const info = workerInfoMap.get(workerId);
      const key = `${log.id}:${workerId}`;
      const lastExport = latestExportByKey.get(key) ?? null;

      rows.push({
        key,
        auditLogId: log.id,
        area: info?.areaNegocio ?? "",
        sucursal: info?.branchNombre ?? "",
        codigo: info?.branchCodigo ?? "",
        fechaMod: log.createdAt.toISOString(),
        modificadoPor: log.userEmail ?? "Sistema",
        workerId,
        trabajador: workerChanges[0].workerName,
        eventos: workerChanges.length,
        cambios: workerChanges.map(({ date, dayLabel, from, to }) => ({ date, dayLabel, from, to })),
        fechaDescarga: lastExport?.exportedAt.toISOString() ?? null,
        descargadoPor: lastExport?.exportedBy ?? null,
      });
    }
  }

  const deduped = dedupeIdenticalSaves(rows);
  deduped.sort((a, b) => b.fechaMod.localeCompare(a.fechaMod));
  return deduped;
}
