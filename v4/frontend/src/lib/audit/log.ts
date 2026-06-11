import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession, getSessionFromRequest } from "@/lib/auth/session";
import { isNotifiableAction, sendAuditWebhook, type WebhookPayload } from "./webhook";

const APP_URL = process.env.APP_URL ?? "https://teamplanner.pompeyo.cl";

interface LogActionInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  branchId?: string | null;
  req?: NextRequest;
  webhookExtras?: { fileBase64?: string; fileName?: string };
}

function buildDescription(
  action: string,
  metadata: Record<string, unknown> | null,
  supervisorNombre: string | null,
  branchName: string | null,
): string {
  const nombre = supervisorNombre ?? "Sistema";
  const branch = branchName ?? "";

  switch (action) {
    case "calendar.generate": {
      const { month, year, scopeLabel, mode } = metadata ?? {};
      const period = month && year ? `${month}/${year}` : "";
      const scope = String(scopeLabel ?? branch);
      const verb = mode === "update" ? "actualizó" : "generó";
      return `${nombre} ${verb} el calendario ${period} de ${scope}`.trim();
    }
    case "calendar.save": {
      const { month, year, scopeLabel, changes } = metadata ?? {};
      const period = month && year ? `${month}/${year}` : "";
      const scope = String(scopeLabel ?? branch);
      let desc = `${nombre} guardó y notificó el calendario ${period} de ${scope}`.trim();
      if (Array.isArray(changes) && changes.length > 0) {
        desc += "\n\nCambios en el calendario:";
        for (const c of changes as Array<{ workerName: string; dayLabel: string; from: string | null; to: string | null }>) {
          let line: string;
          if (!c.from && c.to) {
            line = `• ${nombre} le asignó turno el ${c.dayLabel} a ${c.workerName}: estaba libre, quedó trabajando de ${c.to}`;
          } else if (c.from && !c.to) {
            line = `• ${nombre} le quitó el turno del ${c.dayLabel} a ${c.workerName}: trabajaba de ${c.from}, quedó libre`;
          } else {
            line = `• ${nombre} le cambió el turno del ${c.dayLabel} a ${c.workerName}: de ${c.from} a ${c.to}`;
          }
          desc += `\n${line}`;
        }
      }
      return desc;
    }
    case "calendar.delete": {
      const { month, year } = metadata ?? {};
      const period = month && year ? `${month}/${year}` : "";
      return `${nombre} eliminó el calendario ${period} de ${branch}`.trim();
    }
    case "dotacion.sync": {
      const { workersUpserted, workersDeactivated, branchesCreated } = metadata ?? {};
      const parts: string[] = [];
      if (workersUpserted) parts.push(`${workersUpserted} vendedores`);
      if (workersDeactivated) parts.push(`${workersDeactivated} desactivados`);
      if (branchesCreated) parts.push(`${branchesCreated} sucursales nuevas`);
      return `${nombre} sincronizó dotación` + (parts.length ? `: ${parts.join(", ")}` : "");
    }
    case "worker.block": {
      const { workerNombre, startDate, endDate, motivo } = metadata ?? {};
      const dates = startDate && endDate ? ` del ${startDate} al ${endDate}` : "";
      const motivoStr = motivo ? ` (${motivo})` : "";
      return `${nombre} bloqueó a ${workerNombre ?? "vendedor"}${dates}${motivoStr} — ${branch}`.trim();
    }
    case "worker.unblock": {
      const { workerNombre, startDate, endDate } = metadata ?? {};
      const dates = startDate && endDate ? ` (${startDate} → ${endDate})` : "";
      return `${nombre} desbloqueó a ${workerNombre ?? "vendedor"}${dates} — ${branch}`.trim();
    }
    default:
      return `${nombre}: ${action}`;
  }
}

function buildSubject(
  action: string,
  metadata: Record<string, unknown> | null,
  branchName: string | null,
): string {
  const branch = branchName ?? "";
  const period =
    metadata?.month && metadata?.year ? ` — ${metadata.month}/${metadata.year}` : "";

  switch (action) {
    case "calendar.generate": {
      const scope = String(metadata?.scopeLabel ?? branch);
      const verb = metadata?.mode === "update" ? "Calendario actualizado" : "Nuevo calendario";
      return `${verb} — ${scope}${period}`.trim();
    }
    case "calendar.save": {
      const scope = String(metadata?.scopeLabel ?? branch);
      return `Calendario listo para revisión — ${scope}${period}`.trim();
    }
    case "calendar.delete": {
      return `Calendario eliminado — ${branch}${period}`.trim();
    }
    case "dotacion.sync": {
      const count = metadata?.workersUpserted ? ` (${metadata.workersUpserted} vendedores)` : "";
      return `Dotación sincronizada${count}`.trim();
    }
    case "worker.block": {
      const nombre = metadata?.workerNombre ? String(metadata.workerNombre) : "Vendedor";
      return `Vendedor bloqueado — ${nombre} (${branch})`.trim();
    }
    case "worker.unblock": {
      const nombre = metadata?.workerNombre ? String(metadata.workerNombre) : "Vendedor";
      return `Vendedor desbloqueado — ${nombre} (${branch})`.trim();
    }
    default:
      return action;
  }
}

function buildCalendarUrl(
  branchId: string | null,
  metadata: Record<string, unknown> | null,
): string | null {
  if (!branchId) return null;
  const year = metadata?.year;
  const month = metadata?.month;
  const teamId = typeof metadata?.teamId === "string" ? metadata.teamId : null;
  if (!year || !month) return `${APP_URL}/admin/sucursales/${branchId}`;
  if (!teamId) return `${APP_URL}/admin/sucursales/${branchId}`;
  return `${APP_URL}/admin/sucursales/${branchId}/calendario/${year}/${month}?team=${teamId}`;
}

export async function logAction({
  action,
  entityType,
  entityId = null,
  metadata = null,
  branchId = null,
  req,
  webhookExtras,
}: LogActionInput) {
  const session = req ? await getSessionFromRequest(req) : await getSession();

  const log = await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      branchId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      userId: session?.userId ?? session?.supervisorId ?? session?.workerId ?? null,
      userEmail: session?.email ?? null,
      userRole: session?.role ?? null,
    },
    include: {
      branch: { select: { nombre: true } },
    },
  });

  if (isNotifiableAction(action)) {
    const supervisorNombre = session?.nombre ?? null;
    const branchName = log.branch?.nombre ?? null;

    void sendAuditWebhook({
      action,
      entityType,
      entityId,
      userEmail: session?.email ?? null,
      supervisorNombre,
      branchId,
      branchName,
      asunto: buildSubject(action, metadata, branchName),
      descripcion: buildDescription(action, metadata, supervisorNombre, branchName),
      calendarUrl: buildCalendarUrl(branchId, metadata),
      timestamp: log.createdAt.toISOString(),
      metadata,
      changes: Array.isArray(metadata?.changes) ? (metadata.changes as WebhookPayload["changes"]) : undefined,
      ...webhookExtras,
    });
  }

  return log;
}
