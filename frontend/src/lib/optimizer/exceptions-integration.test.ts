import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildOptimizePayload } from "./build-payload";
import { checkConstraintViolations } from "./check-constraint-violations";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockGetDocument,
  mockListDocuments,
} = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockListDocuments: vi.fn(),
}));

vi.mock("@/lib/auth/appwrite-client", () => ({
  databases: {
    getDocument: mockGetDocument,
    listDocuments: mockListDocuments,
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRANCH_ID = "branch-1";
const WORKER_RUT = "17286931-9";
const PROHIBITED_SHIFT = "S_09_19";

const branch = {
  $id: BRANCH_ID,
  codigo_area: "1200",
  nombre: "NISSAN IRARRÁZAVAL",
  tipo_franja: "autopark",
  activa: true,
};

const branchConfig = {
  $id: "autopark",
  nombre_display: "Autopark",
  franja_por_dia: {
    lunes:    { apertura: "09:00", cierre: "19:00" },
    martes:   { apertura: "09:00", cierre: "19:00" },
    miercoles:{ apertura: "09:00", cierre: "19:00" },
    jueves:   { apertura: "09:00", cierre: "19:00" },
    viernes:  { apertura: "09:00", cierre: "19:00" },
    sabado:   { apertura: "10:00", cierre: "18:00" },
    domingo:  null,
  },
  shifts_aplicables: [PROHIBITED_SHIFT, "S_10_18"],
};

const worker = {
  $id: "w1",
  rut: WORKER_RUT,
  nombre_completo: "ABARZUA VARGAS ANDREA",
  branch_id: BRANCH_ID,
  activo: true,
};

const turnoProhibidoConstraint = {
  $id: "exc1",
  $createdAt: "2026-04-01T00:00:00.000Z",
  $updatedAt: "2026-04-01T00:00:00.000Z",
  worker_id: "w1",
  tipo: "turno_prohibido",
  valor: PROHIBITED_SHIFT,
  creado_por: "admin1",
};

const shifts = [
  { $id: PROHIBITED_SHIFT, nombre_display: "09-19", hora_inicio: "09:00", hora_fin: "19:00", duracion_minutos: 600, descuenta_colacion: true, categoria: "principal" },
  { $id: "S_10_18", nombre_display: "10-18", hora_inicio: "10:00", hora_fin: "18:00", duracion_minutos: 480, descuenta_colacion: false, categoria: "principal" },
];

const holidays = [
  { $id: "h1", fecha: "2026-05-01", nombre: "Día del Trabajo", tipo: "irrenunciable", anio: 2026 },
];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockGetDocument.mockImplementation(async (_db: string, collection: string, id: string) => {
    if (collection === "branches") return branch;
    throw new Error(`getDocument inesperado: ${collection}/${id}`);
  });

  mockListDocuments.mockImplementation(async (_db: string, collection: string) => {
    if (collection === "branch_type_config") return { documents: [branchConfig] };
    if (collection === "workers")            return { documents: [worker] };
    if (collection === "worker_constraints") return { documents: [turnoProhibidoConstraint] };
    if (collection === "shift_catalog")      return { documents: shifts };
    if (collection === "holidays")           return { documents: holidays };
    return { documents: [] };
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Integración: excepción turno_prohibido llega al payload del optimizador", () => {
  it("el payload incluye el constraint turno_prohibido del trabajador", async () => {
    const payload = await buildOptimizePayload(BRANCH_ID, 2026, 5);

    const workerPayload = payload.workers.find((w) => w.rut === WORKER_RUT);
    expect(workerPayload).toBeDefined();
    expect(workerPayload!.constraints).toContainEqual({
      tipo: "turno_prohibido",
      valor: PROHIBITED_SHIFT,
    });
  });

  it("el payload incluye el feriado del mes", async () => {
    const payload = await buildOptimizePayload(BRANCH_ID, 2026, 5);
    expect(payload.holidays).toContain("2026-05-01");
  });

  it("el payload incluye los turnos del catálogo de la sucursal", async () => {
    const payload = await buildOptimizePayload(BRANCH_ID, 2026, 5);
    const shiftIds = payload.shift_catalog.map((s) => s.id);
    expect(shiftIds).toContain(PROHIBITED_SHIFT);
  });
});

describe("checkConstraintViolations: verifica que el optimizador respetó turno_prohibido", () => {
  const workers = [
    { rut: WORKER_RUT, constraints: [{ tipo: "turno_prohibido" as const, valor: PROHIBITED_SHIFT }] },
  ];

  it("no detecta violaciones cuando el optimizador NO asigna el turno prohibido", () => {
    const assignments = [
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-05", shift_id: "S_10_18" },
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-06", shift_id: "S_10_18" },
    ];

    const violations = checkConstraintViolations(assignments, workers);
    expect(violations).toHaveLength(0);
  });

  it("detecta violación cuando el optimizador asigna el turno prohibido", () => {
    const assignments = [
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-05", shift_id: PROHIBITED_SHIFT },
    ];

    const violations = checkConstraintViolations(assignments, workers);
    expect(violations).toHaveLength(1);
    expect(violations[0].workerRut).toBe(WORKER_RUT);
    expect(violations[0].constraint.valor).toBe(PROHIBITED_SHIFT);
  });

  it("solo reporta violaciones para el turno prohibido, no para turnos permitidos", () => {
    const assignments = [
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-04", shift_id: "S_10_18" },
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-05", shift_id: PROHIBITED_SHIFT },
      { worker_slot: 1, worker_rut: WORKER_RUT, date: "2026-05-06", shift_id: "S_10_18" },
    ];

    const violations = checkConstraintViolations(assignments, workers);
    expect(violations).toHaveLength(1);
    expect(violations[0].assignment.date).toBe("2026-05-05");
  });

  it("no reporta violaciones para un worker sin restricciones", () => {
    const assignments = [
      { worker_slot: 2, worker_rut: "99999999-9", date: "2026-05-05", shift_id: PROHIBITED_SHIFT },
    ];
    const workersNoConstraints = [{ rut: "99999999-9", constraints: [] }];

    const violations = checkConstraintViolations(assignments, workersNoConstraints);
    expect(violations).toHaveLength(0);
  });
});
