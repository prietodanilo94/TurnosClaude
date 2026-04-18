import { account } from "@/lib/auth/appwrite-client";

const OPTIMIZER_URL = process.env.NEXT_PUBLIC_OPTIMIZER_URL ?? "http://localhost:8000";

export class ExportError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ExportError";
  }
}

function extractFilename(contentDisposition: string, fallback: string): string {
  const match = contentDisposition.match(/filename="?([^";\s]+)"?/);
  return match?.[1] ?? fallback;
}

/**
 * Obtiene un JWT de Appwrite, llama a POST /export y dispara la descarga del .xlsx.
 * Lanza ExportError si el backend responde con error.
 */
export async function triggerDownload(proposalId: string): Promise<void> {
  // JWT de corta duración para autenticar al backend
  const { jwt } = await account.createJWT();

  const res = await fetch(`${OPTIMIZER_URL}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
    },
    body: JSON.stringify({ proposal_id: proposalId }),
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      detail = (await res.text()) || detail;
    }
    throw new ExportError(detail, res.status);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = extractFilename(disposition, `turnos_${proposalId}.xlsx`);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
