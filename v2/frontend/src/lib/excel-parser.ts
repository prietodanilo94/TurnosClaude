import * as XLSX from "xlsx";
import { validarRut } from "./rut-utils";

export interface ParsedRow {
  rut: string;           // normalizado "XXXXXXXX-X"
  nombre: string;
  codigoArea: string;    // ej: "1200"
  nombreSucursal: string; // ej: "Local Nissan Irarrazaval 965"
  areaNegocio: "ventas" | "postventa";
  supervisor: string;
  filaExcel: number;     // número de fila original (base 1, sin encabezado)
}

export interface ParseError {
  fila: number;
  motivo: string;
  rawRut?: string;
  rawArea?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const COL_ALIASES: Record<string, string[]> = {
  rut:        ["rut"],
  nombre:     ["nombre"],
  area:       ["área", "area"],
  areaNegocio: ["área de negocio", "area de negocio", "area negocio"],
  supervisor: ["supervisor"],
};

function findHeader(headers: string[], field: keyof typeof COL_ALIASES): number {
  const aliases = COL_ALIASES[field];
  return headers.findIndex((h) =>
    aliases.some((a) => h.trim().toLowerCase() === a)
  );
}

/** "1200 Local Nissan Irarrazaval 965" → { codigo: "1200", nombre: "Local Nissan..." } */
function parseArea(raw: string): { codigo: string; nombre: string } | null {
  const match = raw.trim().match(/^(\d{1,6})\s+(.+)$/);
  if (!match) return null;
  return { codigo: match[1].trim(), nombre: match[2].trim() };
}

function parseAreaNegocio(raw: string): "ventas" | "postventa" | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "ventas") return "ventas";
  if (normalized === "postventa") return "postventa";
  return null;
}

// ─── parser principal ─────────────────────────────────────────────────────────

export function parseDotacionExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: false,
        }) as string[][];

        if (raw.length < 2) {
          return resolve({ rows: [], errors: [] });
        }

        // Detectar encabezados (primera fila no vacía)
        const headerRow = raw[0].map((c) => String(c));
        const colRut        = findHeader(headerRow, "rut");
        const colNombre     = findHeader(headerRow, "nombre");
        const colArea       = findHeader(headerRow, "area");
        const colAreaNegocio = findHeader(headerRow, "areaNegocio");
        const colSupervisor = findHeader(headerRow, "supervisor");

        if (colRut < 0 || colNombre < 0 || colArea < 0 || colAreaNegocio < 0) {
          return reject(
            new Error(
              `El archivo no tiene las columnas requeridas.\nEncontradas: [${headerRow.join(", ")}].\nFaltan algunas de: Rut, Nombre, Área, Área de Negocio.`
            )
          );
        }

        const rows: ParsedRow[] = [];
        const errors: ParseError[] = [];

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          const rawRut  = String(row[colRut] ?? "").trim();
          const rawNombre = String(row[colNombre] ?? "").trim();
          const rawArea = String(row[colArea] ?? "").trim();
          const rawAreaNegocio = String(row[colAreaNegocio] ?? "").trim();
          const rawSupervisor = colSupervisor >= 0 ? String(row[colSupervisor] ?? "").trim() : "";
          const fila = i + 1; // +1 por encabezado

          if (!rawRut) continue;

          // Validar RUT
          const rutResult = validarRut(rawRut);
          if (!rutResult.valido) {
            errors.push({ fila, motivo: `RUT inválido: "${rawRut}"`, rawRut });
            continue;
          }

          // Validar Área
          if (!rawArea) {
            errors.push({ fila, motivo: "Columna Área vacía", rawRut });
            continue;
          }
          const area = parseArea(rawArea);
          if (!area) {
            errors.push({
              fila,
              motivo: `Área sin código numérico al inicio: "${rawArea}"`,
              rawRut,
              rawArea,
            });
            continue;
          }

          // Validar Área de Negocio
          const areaNegocio = parseAreaNegocio(rawAreaNegocio);
          if (!areaNegocio) {
             errors.push({
               fila,
               motivo: `Área de negocio desconocida: "${rawAreaNegocio}". Debe ser 'Ventas' o 'Postventa'.`,
               rawRut
             });
             continue;
          }

          rows.push({
            rut: rutResult.normalizado,
            nombre: rawNombre,
            codigoArea: area.codigo,
            nombreSucursal: area.nombre,
            areaNegocio: areaNegocio,
            supervisor: rawSupervisor,
            filaExcel: fila,
          });
        }

        resolve({ rows, errors });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}
