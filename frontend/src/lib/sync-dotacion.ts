import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { DotacionDiff, SyncReport } from "@/types/dotacion-sync";
import type { ParsedRow } from "@/lib/excel-parser";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const now = () => new Date().toISOString();

export async function syncDotacion(
  diff: DotacionDiff,
  rows: ParsedRow[],
  onProgress?: (msg: string) => void
): Promise<SyncReport> {
  const report: SyncReport = { creados: 0, actualizados: 0, desactivados: 0, sinCambios: 0, errores: [] };

  // ── 1. Crear sucursales nuevas ────────────────────────────────────────────
  const skippedBranchCodes = new Set(
    diff.branches.filter((b) => b.isNew && !b.tipoFranja).map((b) => b.codigoArea)
  );

  const branchIdByCode = new Map<string, string>(
    diff.branches
      .filter((b) => !b.isNew && b.branchId)
      .map((b) => [b.codigoArea, b.branchId!])
  );

  for (const branch of diff.branches.filter((b) => b.isNew)) {
    if (!branch.tipoFranja) continue; // sin tipo → se omite hasta el próximo upload
    onProgress?.(`Creando sucursal ${branch.codigoArea}…`);
    try {
      const doc = await databases.createDocument(DB, "branches", ID.unique(), {
        codigo_area: branch.codigoArea,
        nombre: branch.nombre,
        tipo_franja: branch.tipoFranja,
        activa: true,
        creada_desde_excel: true,
      });
      branchIdByCode.set(branch.codigoArea, doc.$id);
    } catch (e: any) {
      report.errores.push(`Sucursal ${branch.codigoArea}: ${e.message}`);
    }
  }

  // ── 2. Upsert workers ─────────────────────────────────────────────────────
  const rowByRut = new Map(rows.map((r) => [r.rut, r]));

  for (const wd of diff.workers) {
    const row = wd.row;
    const branchId = branchIdByCode.get(row.codigoArea);

    if (!branchId) {
      if (!skippedBranchCodes.has(row.codigoArea)) {
        report.errores.push(`Worker ${row.rut}: no se encontró sucursal ${row.codigoArea}`);
      }
      continue;
    }

    if (wd.status === "sin_cambios") {
      report.sinCambios++;
      continue;
    }

    const data = {
      rut: row.rut,
      nombre_completo: row.nombre,
      branch_id: branchId,
      supervisor_nombre: row.supervisor || null,
      activo: true,
      ultima_sync_excel: now(),
    };

    try {
      if (wd.status === "nuevo") {
        onProgress?.(`Creando ${row.nombre}…`);
        await databases.createDocument(DB, "workers", ID.unique(), data);
        report.creados++;
      } else {
        onProgress?.(`Actualizando ${row.nombre}…`);
        await databases.updateDocument(DB, "workers", wd.workerId!, data);
        report.actualizados++;
      }
    } catch (e: any) {
      report.errores.push(`Worker ${row.rut}: ${e.message}`);
    }
  }

  // ── 3. Soft-delete workers removidos ─────────────────────────────────────
  for (const w of diff.toDeactivate) {
    onProgress?.(`Desactivando ${w.nombre}…`);
    try {
      await databases.updateDocument(DB, "workers", w.workerId, { activo: false });
      report.desactivados++;
    } catch (e: any) {
      report.errores.push(`Desactivar ${w.rut}: ${e.message}`);
    }
  }

  // ── 4. Audit log ──────────────────────────────────────────────────────────
  try {
    const authUser = await import("@/lib/auth/appwrite-client").then((m) =>
      m.account.get().catch(() => null)
    );
    await databases.createDocument(DB, "audit_log", ID.unique(), {
      user_id: authUser?.$id ?? "unknown",
      accion: "upload_excel",
      entidad: "workers",
      metadata: JSON.stringify({
        creados: report.creados,
        actualizados: report.actualizados,
        desactivados: report.desactivados,
        errores: report.errores.length,
      }),
    });
  } catch {
    // audit_log no crítico
  }

  return report;
}
