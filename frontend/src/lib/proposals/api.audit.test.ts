/**
 * Tests de audit log — Spec 010 Task 13.
 * Verifica que cada transición de estado escribe una entrada en audit_log
 * y que un fallo en el audit log NO interrumpe la operación principal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  publishProposal,
  selectProposal,
  discardProposal,
  exportProposal,
} from "./api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetDocument, mockUpdateDocument, mockListDocuments, mockCreateDocument } =
  vi.hoisted(() => ({
    mockGetDocument: vi.fn(),
    mockUpdateDocument: vi.fn(),
    mockListDocuments: vi.fn(),
    mockCreateDocument: vi.fn(),
  }));

vi.mock("@/lib/auth/appwrite-client", () => ({
  databases: {
    getDocument: mockGetDocument,
    updateDocument: mockUpdateDocument,
    listDocuments: mockListDocuments,
    createDocument: mockCreateDocument,
  },
}));

function makeProposal(estado: string) {
  return {
    $id: "prop1", $createdAt: "", $updatedAt: "",
    branch_id: "b1", anio: 2026, mes: 5,
    modo: "ilp", score: 90, factible: true,
    asignaciones: "[]", dotacion_sugerida: 2,
    parametros: "{}", estado,
    creada_por: "user1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDocument.mockResolvedValue({});
  mockListDocuments.mockResolvedValue({ documents: [] });
  mockCreateDocument.mockResolvedValue({ $id: "audit1" });
});

// ─── publishProposal ──────────────────────────────────────────────────────────

describe("audit log — publishProposal", () => {
  it("escribe una entrada con accion 'proposal.publicar'", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("generada"));

    await publishProposal("prop1", "admin-user");

    const auditCall = mockCreateDocument.mock.calls.find(
      (c) => c[1] === "audit_log"
    );
    expect(auditCall).toBeDefined();
    expect(auditCall![3].accion).toBe("proposal.publicar");
    expect(auditCall![3].entidad_id).toBe("prop1");
    expect(auditCall![3].user_id).toBe("admin-user");

    const metadata = JSON.parse(auditCall![3].metadata);
    expect(metadata.estado_anterior).toBe("generada");
    expect(metadata.estado_nuevo).toBe("publicada");
  });

  it("no falla si el audit log da error (best-effort)", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("generada"));
    mockCreateDocument.mockRejectedValue(new Error("Appwrite audit error"));

    await expect(publishProposal("prop1", "admin-user")).resolves.not.toThrow();
    expect(mockUpdateDocument).toHaveBeenCalled();
  });
});

// ─── selectProposal ───────────────────────────────────────────────────────────

describe("audit log — selectProposal", () => {
  it("escribe una entrada con accion 'proposal.seleccionar'", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("publicada"));

    await selectProposal("prop1", "b1", 2026, 5, "admin", "admin-user");

    const auditCall = mockCreateDocument.mock.calls.find(
      (c) => c[1] === "audit_log" && c[3].accion === "proposal.seleccionar"
    );
    expect(auditCall).toBeDefined();
    expect(auditCall![3].user_id).toBe("admin-user");

    const metadata = JSON.parse(auditCall![3].metadata);
    expect(metadata.estado_anterior).toBe("publicada");
    expect(metadata.estado_nuevo).toBe("seleccionada");
  });

  it("escribe entradas 'proposal.descartar_por_seleccion' para las otras propuestas", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("publicada"));
    mockListDocuments.mockResolvedValue({
      documents: [makeProposal("publicada"), { ...makeProposal("generada"), $id: "prop2" }],
    });

    await selectProposal("prop1", "b1", 2026, 5, "admin", "admin-user");

    const discardAudits = mockCreateDocument.mock.calls.filter(
      (c) => c[1] === "audit_log" && c[3].accion === "proposal.descartar_por_seleccion"
    );
    expect(discardAudits).toHaveLength(2);
  });

  it("usa 'system' como userId por defecto", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("publicada"));

    await selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal");

    const auditCall = mockCreateDocument.mock.calls.find(
      (c) => c[1] === "audit_log" && c[3].accion === "proposal.seleccionar"
    );
    expect(auditCall![3].user_id).toBe("system");
  });
});

// ─── discardProposal ──────────────────────────────────────────────────────────

describe("audit log — discardProposal", () => {
  it("escribe una entrada con accion 'proposal.descartar'", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("generada"));

    await discardProposal("prop1", "admin", "admin-user");

    const auditCall = mockCreateDocument.mock.calls.find(
      (c) => c[1] === "audit_log"
    );
    expect(auditCall).toBeDefined();
    expect(auditCall![3].accion).toBe("proposal.descartar");

    const metadata = JSON.parse(auditCall![3].metadata);
    expect(metadata.estado_anterior).toBe("generada");
    expect(metadata.estado_nuevo).toBe("descartada");
  });

  it("NO escribe audit log si la transición es inválida", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("descartada"));

    await discardProposal("prop1", "admin").catch(() => {/* esperado */});

    const auditCalls = mockCreateDocument.mock.calls.filter(
      (c) => c[1] === "audit_log"
    );
    expect(auditCalls).toHaveLength(0);
  });
});

// ─── exportProposal ───────────────────────────────────────────────────────────

describe("audit log — exportProposal", () => {
  it("escribe una entrada con accion 'proposal.exportar'", async () => {
    mockGetDocument.mockResolvedValue(makeProposal("seleccionada"));

    await exportProposal("prop1", "admin", "admin-user");

    const auditCall = mockCreateDocument.mock.calls.find(
      (c) => c[1] === "audit_log"
    );
    expect(auditCall).toBeDefined();
    expect(auditCall![3].accion).toBe("proposal.exportar");

    const metadata = JSON.parse(auditCall![3].metadata);
    expect(metadata.estado_anterior).toBe("seleccionada");
    expect(metadata.estado_nuevo).toBe("exportada");
  });
});
