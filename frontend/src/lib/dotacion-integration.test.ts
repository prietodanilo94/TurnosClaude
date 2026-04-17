import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeDiff } from "./compute-diff";
import { syncDotacion } from "./sync-dotacion";
import type { ParsedRow } from "./excel-parser";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const { mockListDocuments, mockCreateDocument, mockUpdateDocument, mockAccountGet } =
  vi.hoisted(() => ({
    mockListDocuments: vi.fn(),
    mockCreateDocument: vi.fn(),
    mockUpdateDocument: vi.fn(),
    mockAccountGet: vi.fn(),
  }));

vi.mock("@/lib/auth/appwrite-client", () => ({
  databases: {
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
    updateDocument: mockUpdateDocument,
  },
  account: { get: mockAccountGet },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const row1: ParsedRow = {
  rut: "11222333-9",
  nombre: "Juan Pérez",
  codigoArea: "S001",
  nombreSucursal: "Sucursal Centro",
  supervisor: "María González",
  filaExcel: 2,
};

const row2: ParsedRow = {
  rut: "76354771-K",
  nombre: "Ana Martínez",
  codigoArea: "S002",
  nombreSucursal: "Sucursal Norte",
  supervisor: "Pedro Soto",
  filaExcel: 3,
};

const branchS001 = {
  $id: "branch-s001",
  codigo_area: "S001",
  nombre: "Sucursal Centro",
  tipo_franja: "standalone",
  activa: true,
};

const branchS002 = {
  $id: "branch-s002",
  codigo_area: "S002",
  nombre: "Sucursal Norte",
  tipo_franja: "standalone",
  activa: true,
};

const worker1 = {
  $id: "worker-1",
  rut: "11222333-9",
  nombre_completo: "Juan Pérez",
  branch_id: "branch-s001",
  supervisor_nombre: "María González",
  activo: true,
};

const worker2 = {
  $id: "worker-2",
  rut: "76354771-K",
  nombre_completo: "Ana Martínez",
  branch_id: "branch-s002",
  supervisor_nombre: "Pedro Soto",
  activo: true,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function setupAppwrite(branches: unknown[], workers: unknown[]) {
  mockListDocuments.mockImplementation(
    async (_db: string, collection: string) => ({
      documents: collection === "branches" ? branches : workers,
      total: collection === "branches" ? branches.length : workers.length,
    })
  );
  mockCreateDocument.mockImplementation(
    async (_db: string, collection: string, _id: string, data: Record<string, unknown>) => ({
      $id: `new-${collection}-${data.codigo_area ?? data.rut ?? "x"}`,
      ...data,
    })
  );
  mockUpdateDocument.mockResolvedValue({});
  mockAccountGet.mockResolvedValue({ $id: "user-test" });
}

beforeEach(() => vi.clearAllMocks());

// ─── Caso 1: primer upload (todo nuevo) ──────────────────────────────────────

describe("Caso 1: primer upload (todo nuevo)", () => {
  beforeEach(() => setupAppwrite([], []));

  it("computeDiff detecta 2 branches nuevas y 2 workers nuevos", async () => {
    const diff = await computeDiff([row1, row2]);

    expect(diff.branches).toHaveLength(2);
    expect(diff.branches.every((b) => b.isNew)).toBe(true);
    expect(diff.workers).toHaveLength(2);
    expect(diff.workers.every((w) => w.status === "nuevo")).toBe(true);
    expect(diff.toDeactivate).toHaveLength(0);
  });

  it("syncDotacion crea 2 branches y 2 workers", async () => {
    const diff = await computeDiff([row1, row2]);
    diff.branches.forEach((b) => { b.tipoFranja = "standalone"; });

    const report = await syncDotacion(diff, [row1, row2]);

    expect(report.creados).toBe(2);
    expect(report.actualizados).toBe(0);
    expect(report.desactivados).toBe(0);
    expect(report.errores).toHaveLength(0);

    const cols = mockCreateDocument.mock.calls.map((c) => c[1]);
    expect(cols.filter((c) => c === "branches")).toHaveLength(2);
    expect(cols.filter((c) => c === "workers")).toHaveLength(2);
  });
});

// ─── Caso 2: re-upload idéntico (no-op) ──────────────────────────────────────

describe("Caso 2: re-upload idéntico (no-op)", () => {
  beforeEach(() => setupAppwrite([branchS001, branchS002], [worker1, worker2]));

  it("computeDiff no genera diff", async () => {
    const diff = await computeDiff([row1, row2]);

    expect(diff.branches.every((b) => !b.isNew)).toBe(true);
    expect(diff.workers.every((w) => w.status === "sin_cambios")).toBe(true);
    expect(diff.toDeactivate).toHaveLength(0);
  });

  it("syncDotacion no escribe branches ni workers", async () => {
    const diff = await computeDiff([row1, row2]);
    const report = await syncDotacion(diff, [row1, row2]);

    expect(report.sinCambios).toBe(2);
    expect(mockUpdateDocument).not.toHaveBeenCalled();

    const cols = mockCreateDocument.mock.calls.map((c) => c[1]);
    expect(cols.filter((c) => c === "branches")).toHaveLength(0);
    expect(cols.filter((c) => c === "workers")).toHaveLength(0);
  });
});

// ─── Caso 3: upload con branch nueva ─────────────────────────────────────────

describe("Caso 3: upload con branch nueva", () => {
  beforeEach(() => setupAppwrite([branchS001], [worker1]));

  it("computeDiff marca S001 existente y S002 nueva", async () => {
    const diff = await computeDiff([row1, row2]);

    const s001 = diff.branches.find((b) => b.codigoArea === "S001");
    const s002 = diff.branches.find((b) => b.codigoArea === "S002");
    expect(s001?.isNew).toBe(false);
    expect(s002?.isNew).toBe(true);
  });

  it("computeDiff marca worker1 sin_cambios y worker2 nuevo", async () => {
    const diff = await computeDiff([row1, row2]);

    const w1 = diff.workers.find((w) => w.row.rut === row1.rut);
    const w2 = diff.workers.find((w) => w.row.rut === row2.rut);
    expect(w1?.status).toBe("sin_cambios");
    expect(w2?.status).toBe("nuevo");
  });

  it("syncDotacion crea solo la branch nueva y 1 worker", async () => {
    const diff = await computeDiff([row1, row2]);
    diff.branches.find((b) => b.isNew)!.tipoFranja = "standalone";

    const report = await syncDotacion(diff, [row1, row2]);

    expect(report.creados).toBe(1);
    expect(report.sinCambios).toBe(1);

    const cols = mockCreateDocument.mock.calls.map((c) => c[1]);
    expect(cols.filter((c) => c === "branches")).toHaveLength(1);
    expect(cols.filter((c) => c === "workers")).toHaveLength(1);
  });
});

// ─── Caso 4: trabajador removido (soft-delete) ────────────────────────────────

describe("Caso 4: trabajador removido (soft-delete)", () => {
  beforeEach(() => setupAppwrite([branchS001, branchS002], [worker1, worker2]));

  it("computeDiff incluye worker2 en toDeactivate cuando solo llega row1", async () => {
    const diff = await computeDiff([row1]);

    expect(diff.toDeactivate).toHaveLength(1);
    expect(diff.toDeactivate[0].rut).toBe(row2.rut);
    expect(diff.toDeactivate[0].workerId).toBe(worker2.$id);
  });

  it("syncDotacion llama updateDocument con activo=false para el removido", async () => {
    const diff = await computeDiff([row1]);
    const report = await syncDotacion(diff, [row1]);

    expect(report.desactivados).toBe(1);

    const deactivateCalls = mockUpdateDocument.mock.calls.filter(
      (c) => c[3]?.activo === false
    );
    expect(deactivateCalls).toHaveLength(1);
    expect(deactivateCalls[0][2]).toBe(worker2.$id);
  });
});
