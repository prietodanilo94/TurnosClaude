// Formato compartido del historial (página + export Excel)

export const ACTION_LABELS: Record<string, string> = {
  "calendar.generate":  "Generó calendario",
  "calendar.save":      "Guardó calendario",
  "calendar.delete":    "Eliminó calendario",
  "calendar.assign":    "Asignó vendedor",
  "calendar.export":    "Exportó calendario",
  "calendar.validation_blocked": "Intentó guardar incompleto",
  "dotacion.sync":      "Sincronizó dotación",
  "worker.block":       "Bloqueó vendedor",
  "worker.unblock":     "Desbloqueó vendedor",
  "supervisor.create":  "Creó supervisor",
  "supervisor.link":    "Vinculó sucursal",
};

export function parseMetadata(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function fmtDetail(metadata: Record<string, unknown> | null, action: string) {
  if (!metadata) return "—";

  if (action === "dotacion.sync") {
    const parts = [];
    if (metadata.branchesCreated) parts.push(`${metadata.branchesCreated} sucursales nuevas`);
    if (metadata.branchesUpdated) parts.push(`${metadata.branchesUpdated} actualizadas`);
    if (metadata.workersUpserted) parts.push(`${metadata.workersUpserted} vendedores`);
    if (metadata.workersDeactivated) parts.push(`${metadata.workersDeactivated} desactivados`);
    if (metadata.supervisorsCreated) parts.push(`${metadata.supervisorsCreated} supervisores nuevos`);
    return parts.join(" · ") || "Sin cambios";
  }

  if (action === "worker.block" || action === "worker.unblock") {
    const motivo = metadata.motivo ? ` — ${metadata.motivo}` : "";
    return `${metadata.workerNombre ?? ""}  ${metadata.startDate ?? ""} → ${metadata.endDate ?? ""}${motivo}`;
  }

  if (action === "calendar.generate" || action === "calendar.save" || action === "calendar.delete" || action === "calendar.export") {
    const { year, month, workerCount } = metadata;
    const parts = [];
    if (year && month) parts.push(`${month}/${year}`);
    if (workerCount !== undefined) parts.push(`${workerCount} vendedores`);
    if (metadata.scopeType) parts.push(metadata.scopeType === "group" ? "grupo" : "sucursal");
    if (metadata.scopeLabel) parts.push(String(metadata.scopeLabel));
    if (metadata.mode) parts.push(String(metadata.mode));
    return parts.join(" · ") || "—";
  }

  if (action === "calendar.validation_blocked") {
    const summary = metadata.validationSummary as { errorCount?: number; warningCount?: number } | undefined;
    const parts = [];
    if (metadata.month && metadata.year) parts.push(`${metadata.month}/${metadata.year}`);
    if (metadata.scopeType) parts.push(metadata.scopeType === "group" ? "grupo" : "sucursal");
    if (metadata.scopeLabel) parts.push(String(metadata.scopeLabel));
    if (summary?.errorCount !== undefined) parts.push(`${summary.errorCount} errores`);
    if (metadata.outcome === "cancelled") parts.push("cancelado");
    if (metadata.outcome === "confirmed_incomplete_save") parts.push("confirmo guardar incompleto");
    return parts.join(" · ") || "Intento guardar con problemas";
  }

  if (action === "supervisor.create" || action === "supervisor.link") {
    return String(metadata.nombre ?? metadata.supervisorNombre ?? "—");
  }

  return Object.entries(metadata)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}
