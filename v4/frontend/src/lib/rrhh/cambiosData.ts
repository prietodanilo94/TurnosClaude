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

  rows.sort((a, b) => b.fechaMod.localeCompare(a.fechaMod));
  return rows;
}
