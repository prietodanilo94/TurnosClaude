import { describe, it, expect } from "vitest";
import { canTransition, allowedActions } from "./state-machine";

// ─── Transiciones válidas ──────────────────────────────────────────────────────

describe("canTransition — transiciones válidas", () => {
  it("admin puede publicar propuesta generada", () => {
    expect(canTransition("generada", "publicar", "admin")).toBe(true);
  });

  it("admin puede descartar propuesta generada", () => {
    expect(canTransition("generada", "descartar", "admin")).toBe(true);
  });

  it("admin puede seleccionar propuesta publicada", () => {
    expect(canTransition("publicada", "seleccionar", "admin")).toBe(true);
  });

  it("jefe_sucursal puede seleccionar propuesta publicada", () => {
    expect(canTransition("publicada", "seleccionar", "jefe_sucursal")).toBe(true);
  });

  it("admin puede descartar propuesta publicada", () => {
    expect(canTransition("publicada", "descartar", "admin")).toBe(true);
  });

  it("admin puede exportar propuesta seleccionada", () => {
    expect(canTransition("seleccionada", "exportar", "admin")).toBe(true);
  });

  it("jefe_sucursal puede exportar propuesta seleccionada", () => {
    expect(canTransition("seleccionada", "exportar", "jefe_sucursal")).toBe(true);
  });

  it("admin puede descartar propuesta seleccionada", () => {
    expect(canTransition("seleccionada", "descartar", "admin")).toBe(true);
  });
});

// ─── Transiciones denegadas por rol ───────────────────────────────────────────

describe("canTransition — denegado por rol incorrecto", () => {
  it("jefe_sucursal no puede publicar propuesta generada", () => {
    expect(canTransition("generada", "publicar", "jefe_sucursal")).toBe(false);
  });

  it("jefe_sucursal no puede descartar propuesta generada", () => {
    expect(canTransition("generada", "descartar", "jefe_sucursal")).toBe(false);
  });

  it("jefe_sucursal no puede descartar propuesta publicada", () => {
    expect(canTransition("publicada", "descartar", "jefe_sucursal")).toBe(false);
  });

  it("jefe_sucursal no puede descartar propuesta seleccionada", () => {
    expect(canTransition("seleccionada", "descartar", "jefe_sucursal")).toBe(false);
  });
});

// ─── Transiciones denegadas por estado ────────────────────────────────────────

describe("canTransition — denegado por estado inválido", () => {
  it("nadie puede hacer ninguna acción desde estado exportada", () => {
    expect(canTransition("exportada", "descartar", "admin")).toBe(false);
    expect(canTransition("exportada", "publicar", "admin")).toBe(false);
    expect(canTransition("exportada", "seleccionar", "admin")).toBe(false);
    expect(canTransition("exportada", "exportar", "admin")).toBe(false);
  });

  it("nadie puede hacer ninguna acción desde estado descartada", () => {
    expect(canTransition("descartada", "publicar", "admin")).toBe(false);
    expect(canTransition("descartada", "seleccionar", "admin")).toBe(false);
    expect(canTransition("descartada", "exportar", "admin")).toBe(false);
  });

  it("no se puede seleccionar desde generada (debe pasar por publicada)", () => {
    expect(canTransition("generada", "seleccionar", "admin")).toBe(false);
    expect(canTransition("generada", "seleccionar", "jefe_sucursal")).toBe(false);
  });

  it("no se puede exportar desde publicada", () => {
    expect(canTransition("publicada", "exportar", "admin")).toBe(false);
    expect(canTransition("publicada", "exportar", "jefe_sucursal")).toBe(false);
  });
});

// ─── allowedActions ───────────────────────────────────────────────────────────

describe("allowedActions", () => {
  it("admin con propuesta generada puede publicar o descartar", () => {
    const actions = allowedActions("generada", "admin");
    expect(actions).toContain("publicar");
    expect(actions).toContain("descartar");
    expect(actions).not.toContain("seleccionar");
    expect(actions).not.toContain("exportar");
  });

  it("jefe_sucursal con propuesta publicada solo puede seleccionar", () => {
    const actions = allowedActions("publicada", "jefe_sucursal");
    expect(actions).toEqual(["seleccionar"]);
  });

  it("admin con propuesta seleccionada puede exportar o descartar", () => {
    const actions = allowedActions("seleccionada", "admin");
    expect(actions).toContain("exportar");
    expect(actions).toContain("descartar");
  });

  it("estado terminal retorna lista vacía", () => {
    expect(allowedActions("exportada", "admin")).toEqual([]);
    expect(allowedActions("descartada", "admin")).toEqual([]);
  });
});
