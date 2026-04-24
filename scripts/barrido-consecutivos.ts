/**
 * Barrido de validación: días consecutivos post-fix.
 *
 * Llama al playground de v3 (cp_sat mode, que usa el optimizer de v2)
 * para N=4..12 trabajadores y verifica que ningún slot supera el límite
 * de días consecutivos configurado.
 *
 * Uso:
 *   npx tsx scripts/barrido-consecutivos.ts
 *   npx tsx scripts/barrido-consecutivos.ts --url http://localhost:3013
 *   npx tsx scripts/barrido-consecutivos.ts --dias-max 6
 */

const BASE_URL = (() => {
  const idx = process.argv.indexOf("--url");
  return idx !== -1 ? process.argv[idx + 1] : "https://turnos3.dpmake.cl";
})();

const DIAS_MAX = (() => {
  const idx = process.argv.indexOf("--dias-max");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 6;
})();

const YEAR  = 2026;
const MONTH = 5;
const DOTACIONES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

// ──────────────────────────────────────────────────────────────────────────────
// Tipos mínimos de la respuesta del playground
// ──────────────────────────────────────────────────────────────────────────────

interface LabAssignment {
  slotId: string;
  date:   string;
  shift:  string;
}

interface LabProposal {
  id:          string;
  score:       number;
  assignments: LabAssignment[];
}

interface LabResponse {
  feasible:    boolean;
  diagnostic:  string;
  proposals:   LabProposal[];
  visibleDays: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function maxConsecutive(assignments: LabAssignment[], slotId: string, allDates: string[]): number {
  const worked = new Set(
    assignments.filter(a => a.slotId === slotId && a.shift !== "OFF").map(a => a.date)
  );
  let maxRun = 0;
  let curRun = 0;
  for (const date of allDates.sort()) {
    if (worked.has(date)) {
      curRun++;
      if (curRun > maxRun) maxRun = curRun;
    } else {
      curRun = 0;
    }
  }
  return maxRun;
}

function uniqueSlots(assignments: LabAssignment[]): string[] {
  return [...new Set(assignments.map(a => a.slotId))].sort();
}

// ──────────────────────────────────────────────────────────────────────────────
// Llamada al API
// ──────────────────────────────────────────────────────────────────────────────

async function callPlayground(dotation: number): Promise<LabResponse | null> {
  const body = {
    category:           "ventas_mall_dominical",
    solverMode:         "cp_sat",
    year:               YEAR,
    month:              MONTH,
    dotation,
    weeklyHoursTarget:  42,
    maxConsecutiveDays: DIAS_MAX,
    minFreeSundays:     2,
    numProposals:       2,
    timeLimitSeconds:   30,
  };

  try {
    const res = await fetch(`${BASE_URL}/api/optimizer-lab`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status} para dotación ${dotation}`);
      return null;
    }
    return res.json() as Promise<LabResponse>;
  } catch (e) {
    console.error(`  Error de conexión para dotación ${dotation}:`, (e as Error).message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(80));
  console.log("BARRIDO DE VALIDACIÓN — DÍAS CONSECUTIVOS POST-FIX");
  console.log("=".repeat(80));
  console.log(`URL:       ${BASE_URL}`);
  console.log(`Año/Mes:   ${YEAR}-${String(MONTH).padStart(2, "0")}`);
  console.log(`Días max:  ${DIAS_MAX}`);
  console.log(`Solver:    cp_sat (v2 optimizer)`);
  console.log();

  const results: Array<{
    dotacion: number;
    feasible: boolean;
    diagnostic: string;
    proposals: number;
    maxConsec: number;
    cumple: boolean;
  }> = [];

  for (const dotacion of DOTACIONES) {
    process.stdout.write(`Dotación ${dotacion}... `);
    const data = await callPlayground(dotacion);

    if (!data) {
      results.push({ dotacion, feasible: false, diagnostic: "Error de conexión", proposals: 0, maxConsec: -1, cumple: false });
      console.log("ERROR");
      continue;
    }

    if (!data.feasible || data.proposals.length === 0) {
      results.push({ dotacion, feasible: false, diagnostic: data.diagnostic, proposals: 0, maxConsec: -1, cumple: true });
      console.log(`No factible: ${data.diagnostic}`);
      continue;
    }

    // Verificar consecutivos en TODAS las propuestas
    let globalMax = 0;
    for (const proposal of data.proposals) {
      const slots = uniqueSlots(proposal.assignments);
      for (const slot of slots) {
        const mc = maxConsecutive(proposal.assignments, slot, data.visibleDays);
        if (mc > globalMax) globalMax = mc;
      }
    }

    const cumple = globalMax <= DIAS_MAX;
    const mark = cumple ? "✓" : "✗ VIOLA";
    console.log(`${data.proposals.length} propuestas, max_consec=${globalMax} ${mark}`);

    results.push({
      dotacion,
      feasible: true,
      diagnostic: data.diagnostic,
      proposals: data.proposals.length,
      maxConsec: globalMax,
      cumple,
    });
  }

  // ── Tabla resumen ──────────────────────────────────────────────────────────
  console.log();
  console.log("─".repeat(80));
  console.log("RESUMEN");
  console.log("─".repeat(80));
  console.log();

  const header = [
    "Dotación".padEnd(10),
    "Factible".padEnd(10),
    "Propuestas".padEnd(12),
    "Max consec".padEnd(12),
    `≤${DIAS_MAX} días`.padEnd(10),
    "Estado",
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const r of results) {
    const estado = !r.feasible
      ? "Infactible"
      : r.cumple
      ? "✓ CUMPLE"
      : `✗ VIOLA (${r.maxConsec - DIAS_MAX} días de más)`;

    console.log([
      String(r.dotacion).padEnd(10),
      (r.feasible ? "Sí" : "No").padEnd(10),
      String(r.proposals).padEnd(12),
      (r.maxConsec === -1 ? "-" : String(r.maxConsec)).padEnd(12),
      (r.feasible ? (r.cumple ? "Sí" : "No") : "-").padEnd(10),
      estado,
    ].join(" | "));
  }

  console.log();

  const violaciones = results.filter(r => r.feasible && !r.cumple);
  if (violaciones.length === 0) {
    console.log("✓ VALIDACIÓN EXITOSA: ninguna dotación supera el límite de días consecutivos.");
  } else {
    console.log(`✗ VALIDACIÓN FALLIDA: ${violaciones.length} dotación(es) aún violan la restricción.`);
    console.log("  Verificar que el servidor esté corriendo con el código actualizado (git pull + rebuild).");
  }

  console.log();
}

main().catch(console.error);
