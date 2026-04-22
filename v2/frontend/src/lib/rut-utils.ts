/** Calcula el dígito verificador módulo 11 para el cuerpo numérico de un RUT chileno. */
function calcularDV(cuerpo: number): string {
  let suma = 0;
  let factor = 2;
  let n = cuerpo;
  while (n > 0) {
    suma += (n % 10) * factor;
    n = Math.floor(n / 10);
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

export interface RutResult {
  valido: boolean;
  normalizado: string; // "XXXXXXXX-X" si válido, string limpio si inválido
}

/**
 * Valida y normaliza un RUT chileno.
 * Acepta formatos: "12.345.678-9", "12345678-9", "123456789", "12345678-K".
 * Devuelve normalizado como "XXXXXXXX-X" con DV en mayúscula.
 */
export function validarRut(raw: string): RutResult {
  const limpio = raw.trim().toUpperCase().replace(/\./g, "").replace(/\s/g, "");

  // Separar cuerpo y DV
  let cuerpoStr: string;
  let dv: string;

  if (limpio.includes("-")) {
    const parts = limpio.split("-");
    if (parts.length !== 2) return { valido: false, normalizado: limpio };
    [cuerpoStr, dv] = parts;
  } else {
    // Sin guión: último carácter es el DV
    if (limpio.length < 2) return { valido: false, normalizado: limpio };
    cuerpoStr = limpio.slice(0, -1);
    dv = limpio.slice(-1);
  }

  const cuerpo = parseInt(cuerpoStr, 10);
  if (isNaN(cuerpo) || cuerpo < 1_000_000 || cuerpo > 99_999_999) {
    return { valido: false, normalizado: limpio };
  }

  const dvEsperado = calcularDV(cuerpo);
  const normalizado = `${cuerpo}-${dvEsperado}`;

  if (dv !== dvEsperado) {
    return { valido: false, normalizado };
  }

  return { valido: true, normalizado };
}

/** Normaliza un RUT sin validar el DV. Útil para búsquedas. */
export function normalizarRut(raw: string): string {
  return validarRut(raw).normalizado;
}
