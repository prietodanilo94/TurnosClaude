import { ID } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { DotacionDiff, SyncReport } from "@/types/models";
import type { ParsedRow } from "@/lib/excel-parser";
import { getRotationGroup } from "./area-catalog";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const now = () => new Date().toISOString();

export async function syncDotacion(
  diff: DotacionDiff,
  rows: ParsedRow[],
  onProgress?: (msg: string) => void
): Promise<SyncReport> {
  const report: SyncReport = { creados: 0, actualizados: 0, desactivados: 0, sinCambios: 0, errores: [] };

  // ── 1. Crear sucursales nuevas ────────────────────────────────────────────
  // En v2 las sucursales nuevas pueden ser procesadas de inmediato SI tienen franja/clasificacion autoderivadas
  const skippedBranchCodes = new Set(
    diff.branches.filter((b) => b.isNew && !b.tipoFranja).map((b) => b.codigoArea)
  );

  const branchIdByCode = new Map<string, string>(
    diff.branches
      .filter((b) => !b.isNew && b.branchId)
      .map((b) => [b.codigoArea, b.branchId!])
  );

  for (const branch of diff.branches.filter((b) => b.isNew)) {
    if (!branch.tipoFranja || !branch.clasificacion) continue; // sin config → usuario lo debe hacer en el modal
    onProgress?.(`Creando sucursal ${branch.codigoArea}…`);
    try {
      const doc = await databases.createDocument(DB, "branches", ID.unique(), {
        codigo_area: branch.codigoArea,
        nombre: branch.nombre,
        tipo_franja: branch.tipoFranja,
        clasificacion: branch.clasificacion,
        activa: true,
        creada_desde_excel: true,
      });
      branchIdByCode.set(branch.codigoArea, doc.$id);
    } catch (e: any) {
      report.errores.push(`Sucursal ${branch.codigoArea}: ${e.message}`);
    }
  }

  // ── 2. Guardar/Actualizar Workers ─────────────────────────────────────────────
  for (const wd of diff.workers) {
    const row = wd.row;
    const branchId = branchIdByCode.get(row.codigoArea);
    const branchInfo = diff.branches.find(b => b.codigoArea === row.codigoArea);

    if (!branchId || !branchInfo?.clasificacion) {
      if (!skippedBranchCodes.has(row.codigoArea)) {
        report.errores.push(`Worker ${row.rut}: no se encontró sucursal válida ${row.codigoArea}`);
      }
      continue;
    }

    if (wd.status === "sin_cambios") {
      // Opcionalmente podemos forzar el update de ultima_sync_excel aquí, 
      // pero para evitar transacciones lentas, solo lo marcamos como saltado
      report.sinCambios++;
      continue;
    }

    // Calcular el rotationGroup usando rules de negocio v2
    const rotationGroup = getRotationGroup(branchInfo.clasificacion, row.areaNegocio);

    const data = {
      rut: row.rut,
      nombre_completo: row.nombre,
      branch_id: branchId,
      area_negocio: row.areaNegocio,
      rotation_group: rotationGroup,
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
    onProgress?.(`Desactivando ${w.nombre_completo}…`);
    try {
      await databases.updateDocument(DB, "workers", w.$id, { activo: false });
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
