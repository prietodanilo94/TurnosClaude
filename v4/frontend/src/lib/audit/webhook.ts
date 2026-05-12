interface WebhookPayload {
  action: string;
  entityType: string;
  entityId?: string | null;
  userEmail?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
  fileBase64?: string;
  fileName?: string;
}

const DEFAULT_NOTIFIABLE = new Set([
  "calendar.save",
  "calendar.delete",
  "dotacion.sync",
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error("No se pudo enviar webhook de auditoría", error);
  }
}
