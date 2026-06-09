export interface WebhookPayload {
  action: string;
  entityType: string;
  entityId?: string | null;
  userEmail?: string | null;
  supervisorNombre?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  asunto?: string;
  descripcion?: string;
  calendarUrl?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
  fileBase64?: string;
  fileName?: string;
  changes?: Array<{
    workerName: string;
    date: string;
    dayLabel: string;
    from: string | null;
    to: string | null;
  }>;
}

const DEFAULT_NOTIFIABLE = new Set([
  "calendar.save",
]);

export function isNotifiableAction(action: string): boolean {
  return DEFAULT_NOTIFIABLE.has(action);
}

export async function sendAuditWebhook(payload: WebhookPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  const safeBody = JSON.stringify(payload).replace(
    /[^\x00-\x7F]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: safeBody,
      cache: "no-store",
    });
  } catch (error) {
    console.error("No se pudo enviar webhook de auditoria", error);
  }
}