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
}

const DEFAULT_NOTIFIABLE = new Set([
  "calendar.generate",
  "calendar.save",
  "calendar.delete",
  "dotacion.sync",
  "worker.block",
  "worker.unblock",
]);

export function isNotifiableAction(action: string): boolean {
  return DEFAULT_NOTIFIABLE.has(action);
}

export async function sendAuditWebhook(payload: WebhookPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error("No se pudo enviar webhook de auditoría", error);
  }
}
