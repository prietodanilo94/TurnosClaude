import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession, getSessionFromRequest } from "@/lib/auth/session";
import { isNotifiableAction, sendAuditWebhook } from "./webhook";

interface LogActionInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  branchId?: string | null;
  req?: NextRequest;
}

export async function logAction({
  action,
  entityType,
  entityId = null,
  metadata = null,
  branchId = null,
  req,
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
    void sendAuditWebhook({
      action,
      entityType,
      entityId,
      userEmail: session?.email ?? null,
      branchId,
      branchName: log.branch?.nombre ?? null,
      timestamp: log.createdAt.toISOString(),
      metadata,
    });
  }

  return log;
}
