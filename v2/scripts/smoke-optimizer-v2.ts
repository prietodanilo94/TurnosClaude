type Mode = "ilp" | "greedy";

interface Args {
  baseUrl: string;
  mode: Mode;
  year: number;
  month: number;
}

interface AssignmentOut {
  worker_slot: number;
  worker_rut: string;
  date: string;
  shift_id: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    baseUrl: "https://turnos2.dpmake.cl/api",
    mode: "ilp",
    year: 2026,
    month: 5,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--base-url" && next) {
      args.baseUrl = next.replace(/\/+$/, "");
      i++;
      continue;
    }
    if (arg === "--mode" && next && (next === "ilp" || next === "greedy")) {
      args.mode = next;
      i++;
      continue;
    }
    if (arg === "--year" && next) {
      args.year = Number(next);
      i++;
      continue;
    }
    if (arg === "--month" && next) {
      args.month = Number(next);
      i++;
    }
  }

  return args;
}

function buildOptimizePayload(args: Args) {
  return {
    branch: {
      id: "branch_demo",
      codigo_area: "107",
      nombre: "Movicenter Demo",
      tipo_franja: "movicenter",
    },
    rotation_group: "V_M7",
    month: {
      year: args.year,
      month: args.month,
    },
    workers: [
      { rut: "1-9", nombre: "A", constraints: [] },
      { rut: "2-7", nombre: "B", constraints: [] },
      { rut: "3-5", nombre: "C", constraints: [] },
      { rut: "4-3", nombre: "D", constraints: [] },
    ],
    holidays: [],
    shift_catalog: [
      {
        id: "ape",
        nombre_display: "Apertura corta",
        rotation_group: "V_M7",
        nombre_turno: "apertura",
        horario_por_dia: {
          lunes: { inicio: "10:00", fin: "19:00" },
          martes: { inicio: "10:00", fin: "19:00" },
          miercoles: { inicio: "10:00", fin: "19:00" },
          jueves: { inicio: "10:00", fin: "19:00" },
          viernes: { inicio: "10:00", fin: "19:00" },
          sabado: { inicio: "10:00", fin: "19:00" },
          domingo: { inicio: "10:00", fin: "19:00" },
        },
        descuenta_colacion: true,
        dias_aplicables: [
          "lunes",
          "martes",
          "miercoles",
          "jueves",
          "viernes",
          "sabado",
          "domingo",
        ],
      },
      {
        id: "cie",
        nombre_display: "Cierre corto",
        rotation_group: "V_M7",
        nombre_turno: "cierre",
        horario_por_dia: {
          lunes: { inicio: "11:00", fin: "20:00" },
          martes: { inicio: "11:00", fin: "20:00" },
          miercoles: { inicio: "11:00", fin: "20:00" },
          jueves: { inicio: "11:00", fin: "20:00" },
          viernes: { inicio: "11:00", fin: "20:00" },
          sabado: { inicio: "11:00", fin: "20:00" },
          domingo: { inicio: "11:00", fin: "20:00" },
        },
        descuenta_colacion: true,
        dias_aplicables: [
          "lunes",
          "martes",
          "miercoles",
          "jueves",
          "viernes",
          "sabado",
          "domingo",
        ],
      },
      {
        id: "com",
        nombre_display: "Completo",
        rotation_group: "V_M7",
        nombre_turno: "completo",
        horario_por_dia: {
          lunes: { inicio: "10:00", fin: "20:00" },
          martes: { inicio: "10:00", fin: "20:00" },
          miercoles: { inicio: "10:00", fin: "20:00" },
          jueves: { inicio: "10:00", fin: "20:00" },
          viernes: { inicio: "10:00", fin: "20:00" },
          sabado: { inicio: "10:00", fin: "20:00" },
          domingo: { inicio: "10:00", fin: "20:00" },
        },
        descuenta_colacion: true,
        dias_aplicables: [
          "lunes",
          "martes",
          "miercoles",
          "jueves",
          "viernes",
          "sabado",
          "domingo",
        ],
      },
    ],
    franja_por_dia: {
      lunes: { apertura: "10:00", cierre: "20:00" },
      martes: { apertura: "10:00", cierre: "20:00" },
      miercoles: { apertura: "10:00", cierre: "20:00" },
      jueves: { apertura: "10:00", cierre: "20:00" },
      viernes: { apertura: "10:00", cierre: "20:00" },
      sabado: { apertura: "10:00", cierre: "20:00" },
      domingo: { apertura: "10:00", cierre: "20:00" },
    },
    carryover_horas: {},
    parametros: {
      modo: args.mode,
      num_propuestas: 1,
      horas_semanales_max: 42,
      horas_semanales_min: 41,
      horas_semanales_obj: 42,
      dias_maximos_consecutivos: 5,
      domingos_libres_minimos: 2,
      peak_desde: "17:00",
      cobertura_minima: 1,
      cobertura_optima_peak: 1,
      cobertura_optima_off_peak: 1,
      priorizar_fin_de_semana: true,
      time_limit_seconds: 30,
      descanso_entre_jornadas: false,
      peso_cobertura_peak: 10,
      peso_finde: 5,
      peso_balance: 3,
      peso_ociosidad: 1,
    },
  };
}

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  return { status: res.status, data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const optimizePayload = buildOptimizePayload(args);

  console.log(`[smoke] baseUrl=${args.baseUrl}`);
  console.log(`[smoke] optimize mode=${args.mode} month=${args.year}-${String(args.month).padStart(2, "0")}`);

  const optimize = await postJson<{
    propuestas: Array<{
      id: string;
      score: number;
      asignaciones: AssignmentOut[];
    }>;
    diagnostico: {
      dotacion_disponible: number;
      dotacion_minima_requerida: number;
      mensajes: string[];
    };
  }>(`${args.baseUrl}/optimize`, optimizePayload);

  const firstProposal = optimize.data.propuestas[0];
  if (!firstProposal) {
    throw new Error("optimize devolvio 200 pero sin propuestas");
  }

  console.log(
    `[smoke] optimize ok status=${optimize.status} proposal=${firstProposal.id} ` +
      `score=${firstProposal.score} assignments=${firstProposal.asignaciones.length}`
  );

  const validatePayload = {
    ...optimizePayload,
    asignaciones: firstProposal.asignaciones,
  };

  const validate = await postJson<{
    valido: boolean;
    violaciones: Array<{ tipo: string; detalle: string }>;
  }>(`${args.baseUrl}/validate`, validatePayload);

  if (!validate.data.valido) {
    throw new Error(`validate devolvio violaciones: ${JSON.stringify(validate.data.violaciones)}`);
  }

  console.log(
    `[smoke] validate ok status=${validate.status} violations=${validate.data.violaciones.length}`
  );
  console.log("[smoke] RESULT=OK");
}

main().catch((error) => {
  console.error("[smoke] RESULT=FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
