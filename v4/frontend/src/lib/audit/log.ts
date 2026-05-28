import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession, getSessionFromRequest } from "@/lib/auth/session";
import { isNotifiableAction, sendAuditWebhook } from "./webhook";

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
      const { month, year, scopeLabel } = metadata ?? {};
      const period = month && year ? `${month}/${year}` : "";
      const scope = String(scopeLabel ?? branch);
      return `${nombre} guardó y notificó el calendario ${period} de ${scope}`.trim();
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
      descripcion: buildDescription(action, metadata, supervisorNombre, branchName),
      calendarUrl: buildCalendarUrl(branchId, metadata),
      timestamp: log.createdAt.toISOString(),
      metadata,
      ...webhookExtras,
    });
  }

  return log;
}
