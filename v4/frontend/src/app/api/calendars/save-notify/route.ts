import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateGroupCalendarExcel } from "@/lib/excel/calendarExport";
import { sendAuditWebhook } from "@/lib/audit/webhook";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Sin acceso" }, { status: 401 });

  const { teamIds, year, month, scopeLabel, scopeType } = await req.json();

  if (!Array.isArray(teamIds) || teamIds.length === 0 || !year || !month) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  try {
    const { buffer, fileName } = await generateGroupCalendarExcel({ teamIds, year, month, scopeLabel });

    void sendAuditWebhook({
      action: "calendar.save",
      entityType: "calendar",
      entityId: null,
      userEmail: session.email ?? null,
      branchId: null,
      branchName: scopeLabel ?? null,
      timestamp: new Date().toISOString(),
      metadata: { teamIds, year, month, scopeLabel: scopeLabel ?? null, scopeType: scopeType ?? "branch" },
      fileBase64: buffer.toString("base64"),
      fileName,
    });
  } catch (err) {
    console.error("Error generando Excel para webhook:", err);
  }

  return NextResponse.json({ ok: true });
}
