import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishProposal, selectProposal, discardProposal, exportProposal } from "./api";

// ─── Mock del cliente Appwrite ─────────────────────────────────────────────────
// vi.mock se hoisteó al inicio del módulo; las variables deben declararse con vi.hoisted.

const { mockGetDocument, mockUpdateDocument, mockListDocuments } = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockListDocuments: vi.fn(),
}));

vi.mock("@/lib/auth/appwrite-client", () => ({
  databases: {
    getDocument: mockGetDocument,
    updateDocument: mockUpdateDocument,
    listDocuments: mockListDocuments,
  },
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    $id: "prop1",
    $createdAt: "",
    $updatedAt: "",
    branch_id: "b1",
    anio: 2026,
    mes: 5,
    modo: "ilp",
    score: 90,
    factible: true,
    asignaciones: [],
    dotacion_sugerida: 2,
    parametros: {},
    estado: "generada",
    creada_por: "user1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDocument.mockResolvedValue({});
  mockListDocuments.mockResolvedValue({ documents: [] });
});

// ─── publishProposal ──────────────────────────────────────────────────────────

describe("publishProposal", () => {
  it("actualiza estado a publicada cuando está en generada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "generada" }));

    await publishProposal("prop1", "admin-user");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      "proposals",
      "prop1",
      expect.objectContaining({ estado: "publicada", publicada_por: "admin-user" })
    );
  });

  it("lanza error si la propuesta no está en generada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await expect(publishProposal("prop1", "admin-user")).rejects.toThrow(
      /No se puede publicar/
    );
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it("lanza error si la propuesta está descartada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "descartada" }));

    await expect(publishProposal("prop1", "admin-user")).rejects.toThrow();
  });
});

// ─── selectProposal ───────────────────────────────────────────────────────────

describe("selectProposal", () => {
  it("actualiza estado a seleccionada cuando está publicada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await selectProposal("prop1", "b1", 2026, 5, "admin");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      "proposals",
      "prop1",
      { estado: "seleccionada" }
    );
  });

  it("descarta las otras propuestas del mismo (branch, mes)", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));
    mockListDocuments.mockResolvedValue({
      documents: [makeProposal({ $id: "prop2" }), makeProposal({ $id: "prop3" })],
    });

    await selectProposal("prop1", "b1", 2026, 5, "admin");

    // prop2 y prop3 deben quedar descartadas
    const calls = mockUpdateDocument.mock.calls;
    const descartedIds = calls
      .filter((c) => c[3]?.estado === "descartada")
      .map((c) => c[2]);
    expect(descartedIds).toContain("prop2");
    expect(descartedIds).toContain("prop3");
  });

  it("jefe_sucursal puede seleccionar una propuesta publicada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await expect(selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal")).resolves.not.toThrow();
  });

  it("lanza error de concurrencia si ya está seleccionada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "seleccionada" }));

    await expect(selectProposal("prop1", "b1", 2026, 5, "admin")).rejects.toThrow(
      "Otro usuario ya seleccionó una propuesta."
    );
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it("lanza error si la propuesta está en estado generada (saltarse publicada)", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "generada" }));

    await expect(selectProposal("prop1", "b1", 2026, 5, "admin")).rejects.toThrow(
      /No se puede seleccionar/
    );
  });
});

// ─── discardProposal ──────────────────────────────────────────────────────────

describe("discardProposal", () => {
  it("admin puede descartar propuesta generada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "generada" }));

    await discardProposal("prop1", "admin");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      "proposals",
      "prop1",
      { estado: "descartada" }
    );
  });

  it("admin puede descartar propuesta publicada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await discardProposal("prop1", "admin");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      "proposals",
      "prop1",
      { estado: "descartada" }
    );
  });

  it("jefe_sucursal no puede descartar", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await expect(discardProposal("prop1", "jefe_sucursal")).rejects.toThrow(
      /No se puede descartar/
    );
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it("nadie puede descartar una propuesta ya descartada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "descartada" }));

    await expect(discardProposal("prop1", "admin")).rejects.toThrow();
  });
});

// ─── exportProposal ───────────────────────────────────────────────────────────

describe("exportProposal", () => {
  it("admin puede exportar propuesta seleccionada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "seleccionada" }));

    await exportProposal("prop1", "admin");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      "proposals",
      "prop1",
      { estado: "exportada" }
    );
  });

  it("jefe_sucursal puede exportar propuesta seleccionada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "seleccionada" }));

    await expect(exportProposal("prop1", "jefe_sucursal")).resolves.not.toThrow();
  });

  it("lanza error si la propuesta no está seleccionada", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "publicada" }));

    await expect(exportProposal("prop1", "admin")).rejects.toThrow(/No se puede exportar/);
  });
});
