import * as XLSX from "xlsx";
import type { ParseResult, WorkerRow, AreaNegocio } from "@/types";

const COL_ALIASES: Record<string, string[]> = {
  rut:              ["rut"],
  nombre:           ["nombre"],
  area:             ["área", "area"],
  areaNegocio:      ["área de negocio", "area de negocio", "area_negocio", "servicios/ventas"],
  supervisor:       ["supervisor"],
  cargoHomologado:  ["cargo homologado"],
};

function findHeader(headers: string[], field: keyof typeof COL_ALIASES): number {
  return headers.findIndex((h) =>
    COL_ALIASES[field].some((a) => h.trim().toLowerCase() === a),
  );
}

function normalizeRut(raw: string): string | null {
  const clean = raw.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  return `${body}-${dv}`;
}

function parseAreaCodigo(raw: string): { codigo: string; nombre: string } | null {
  const match = raw.trim().match(/^(\d{1,6})\s+(.+)$/);
  if (!match) return null;
  return { codigo: match[1].trim(), nombre: match[2].trim() };
}

function normalizeBranchName(raw: string): string {
  return raw
    .replace(/\busados\b/gi, "Seminuevos")
    .replace(/\blocal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAreaNegocio(raw: string): AreaNegocio | null {
  const v = raw.trim().toLowerCase();
  if (v.includes("venta")) return "ventas";
  if (v.includes("postventa") || v.includes("servicio")) return "postventa";
  return null;
}

export function parseDotacionExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  if (raw.length < 2) return { rows: [], errors: [] };

  const headerRow = raw[0].map((c) => String(c));
  const colRut            = findHeader(headerRow, "rut");
  const colNombre         = findHeader(headerRow, "nombre");
  const colArea           = findHeader(headerRow, "area");
  const colAreaNeg        = findHeader(headerRow, "areaNegocio");
  const colSupervisor     = findHeader(headerRow, "supervisor");
  const colCargo          = findHeader(headerRow, "cargoHomologado");

  const missing: string[] = [];
  if (colRut < 0)    missing.push("Rut");
  if (colNombre < 0) missing.push("Nombre");
  if (colArea < 0)   missing.push("Área");
  if (colAreaNeg < 0) missing.push("Área de Negocio");
  if (missing.length > 0) {
    throw new Error(
      `El archivo no tiene las columnas requeridas: ${missing.join(", ")}. ` +
      `Columnas encontradas: [${headerRow.join(", ")}]`,
    );
  }

  const rows: WorkerRow[] = [];
  const errors: { fila: number; motivo: string }[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rawRut        = String(row[colRut] ?? "").trim();
    const rawNombre     = String(row[colNombre] ?? "").trim();
    const rawArea       = String(row[colArea] ?? "").trim();
    const rawAreaNeg    = String(row[colAreaNeg] ?? "").trim();
    const rawSupervisor = colSupervisor >= 0 ? String(row[colSupervisor] ?? "").trim() : "";
    const rawCargo      = colCargo >= 0 ? String(row[colCargo] ?? "").trim() : "";
    const fila = i + 1;

    if (!rawRut) continue;

    if (colCargo >= 0 && rawCargo.toLowerCase() !== "asesores de venta") continue;

    const rut = normalizeRut(rawRut);
    if (!rut) {
      errors.push({ fila, motivo: `RUT inválido: "${rawRut}"` });
      continue;
    }

    if (!rawArea) {
      errors.push({ fila, motivo: "Columna Área vacía" });
      continue;
    }
    const area = parseAreaCodigo(rawArea);
    if (!area) {
      errors.push({ fila, motivo: `Área sin código al inicio: "${rawArea}"` });
      continue;
    }

    const areaNegocio = normalizeAreaNegocio(rawAreaNeg);
    if (!areaNegocio) {
      errors.push({ fila, motivo: `Área de Negocio no reconocida: "${rawAreaNeg}"` });
      continue;
    }

    rows.push({
      rut,
      nombre: rawNombre,
      codigoBranch: area.codigo,
      nombreBranch: normalizeBranchName(area.nombre),
      areaNegocio,
      supervisor: rawSupervisor || undefined,
      filaExcel: fila,
    });
  }

  return { rows, errors };
}
