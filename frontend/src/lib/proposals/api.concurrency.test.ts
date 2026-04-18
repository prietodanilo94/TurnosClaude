/**
 * Tests de concurrencia — Spec 010 Task 12.
 *
 * Escenario real: dos clientes intentan seleccionar la misma propuesta casi
 * simultáneamente. El SDK JS de Appwrite no soporta updates condicionales
 * nativos, por lo que la mitigación es un check optimista (getDocument antes
 * del update). Esto cubre la mayor parte de los casos prácticos.
 *
 * Hay una ventana de raza estrecha en la que ambos clientes pueden pasar el
 * check antes de que alguno actualice — eso se documenta en Scenario B.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectProposal } from "./api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    $id: "prop1", $createdAt: "", $updatedAt: "",
    branch_id: "b1", anio: 2026, mes: 5,
    modo: "ilp", score: 90, factible: true,
    asignaciones: "[]", dotacion_sugerida: 2,
    parametros: "{}", estado: "publicada",
    creada_por: "user1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDocument.mockResolvedValue({});
  mockListDocuments.mockResolvedValue({ documents: [] });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Concurrencia: dos clientes seleccionando simultáneamente", () => {
  it("Scenario A — segundo cliente ve el estado ya cambiado: uno gana, el otro recibe error claro", async () => {
    // Cliente A ve "publicada" (llega primero al check)
    // Cliente B ve "seleccionada" (A ya actualizó antes del fetch de B)
    mockGetDocument
      .mockResolvedValueOnce(makeProposal({ estado: "publicada" }))
      .mockResolvedValueOnce(makeProposal({ estado: "seleccionada" }));

    const [resultA, resultB] = await Promise.allSettled([
      selectProposal("prop1", "b1", 2026, 5, "admin"),
      selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal"),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("rejected");
    if (resultB.status === "rejected") {
      expect(resultB.reason.message).toBe(
        "Otro usuario ya seleccionó una propuesta. Recarga para ver el estado actual."
      );
    }
  });

  it("Scenario A — el mensaje de error es exactamente el especificado en el plan", async () => {
    mockGetDocument.mockResolvedValue(makeProposal({ estado: "seleccionada" }));

    const err = await selectProposal("prop1", "b1", 2026, 5, "admin").catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(
      "Otro usuario ya seleccionó una propuesta. Recarga para ver el estado actual."
    );
  });

  it("Scenario A — el cliente que falla NO llama a updateDocument", async () => {
    mockGetDocument
      .mockResolvedValueOnce(makeProposal({ estado: "publicada" }))
      .mockResolvedValueOnce(makeProposal({ estado: "seleccionada" }));

    await Promise.allSettled([
      selectProposal("prop1", "b1", 2026, 5, "admin"),
      selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal"),
    ]);

    // Solo el cliente A llama a updateDocument (el que ganó)
    const updateCalls = mockUpdateDocument.mock.calls.filter(
      (c) => c[3]?.estado === "seleccionada"
    );
    expect(updateCalls).toHaveLength(1);
  });

  it("Scenario B — ventana de raza: ambos ven 'publicada' antes de que nadie actualice (limitación conocida)", async () => {
    // Ambos clientes fetchean el estado antes de que ninguno actualice.
    // Con el SDK JS de Appwrite (sin updates condicionales), ambos proceden.
    // Esto documenta la limitación: la ventana de raza no se puede eliminar
    // con el cliente JS; requeriría una Cloud Function o un endpoint backend.
    mockGetDocument
      .mockResolvedValueOnce(makeProposal({ estado: "publicada" }))
      .mockResolvedValueOnce(makeProposal({ estado: "publicada" }));

    const results = await Promise.allSettled([
      selectProposal("prop1", "b1", 2026, 5, "admin"),
      selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal"),
    ]);

    // Ambos se completan sin error — es la ventana conocida de raza
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("fulfilled");

    // Sin embargo, ambos habrán emitido el update "seleccionada"
    const selectCalls = mockUpdateDocument.mock.calls.filter(
      (c) => c[3]?.estado === "seleccionada"
    );
    expect(selectCalls).toHaveLength(2); // dos updates simultáneos — la raza ocurrió
  });

  it("solo se crea UN update 'seleccionada' cuando el check optimista funciona (Scenario A)", async () => {
    mockGetDocument
      .mockResolvedValueOnce(makeProposal({ estado: "publicada" }))
      .mockResolvedValueOnce(makeProposal({ estado: "seleccionada" }));

    await Promise.allSettled([
      selectProposal("prop1", "b1", 2026, 5, "admin"),
      selectProposal("prop1", "b1", 2026, 5, "jefe_sucursal"),
    ]);

    const selectCalls = mockUpdateDocument.mock.calls.filter(
      (c) => c[3]?.estado === "seleccionada"
    );
    expect(selectCalls).toHaveLength(1);
  });
});
