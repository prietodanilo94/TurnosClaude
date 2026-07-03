import { describe, expect, it } from "vitest";
import { buildCambioRows, type RawAuditLogInput, type WorkerInfoInput, type ExportRecordInput } from "./cambiosData";

function log(overrides: Partial<RawAuditLogInput> & { id: string }): RawAuditLogInput {
  return {
    createdAt: new Date("2026-07-01T10:00:00Z"),
    userEmail: "supervisor@pompeyo.cl",
    metadata: null,
    ...overrides,
  };
}

describe("buildCambioRows", () => {
  it("groups changes by workerId within a single log into separate rows", () => {
    const logs = [
      log({
        id: "log-1",
        metadata: JSON.stringify({
          changes: [
            { workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "Jue 02 Jul", from: null, to: "10:00-18:00" },
            { workerId: "w1", workerName: "Ana", date: "2026-07-03", dayLabel: "Vie 03 Jul", from: "10:00-18:00", to: null },
            { workerId: "w2", workerName: "Beto", date: "2026-07-02", dayLabel: "Jue 02 Jul", from: null, to: "09:00-17:00" },
          ],
        }),
      }),
    ];

    const workerInfoMap = new Map<string, WorkerInfoInput>([
      ["w1", { areaNegocio: "ventas", branchNombre: "Peugeot Mall Plaza Sur", branchCodigo: "101" }],
      ["w2", { areaNegocio: "ventas", branchNombre: "Peugeot Mall Plaza Sur", branchCodigo: "101" }],
    ]);

    const rows = buildCambioRows(logs, workerInfoMap, []);

    expect(rows).toHaveLength(2);
    const ana = rows.find((r) => r.workerId === "w1")!;
    expect(ana.key).toBe("log-1:w1");
    expect(ana.eventos).toBe(2);
    expect(ana.trabajador).toBe("Ana");
    expect(ana.sucursal).toBe("Peugeot Mall Plaza Sur");
    expect(ana.fechaDescarga).toBeNull();
    expect(ana.descargadoPor).toBeNull();
  });

  it("keeps two saves of the same worker as two independent rows", () => {
    const logs = [
      log({ id: "log-1", metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "Jue 02 Jul", from: null, to: "10:00-18:00" }] }) }),
      log({ id: "log-2", createdAt: new Date("2026-07-02T10:00:00Z"), metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-05", dayLabel: "Dom 05 Jul", from: null, to: "10:00-18:00" }] }) }),
    ];

    const rows = buildCambioRows(logs, new Map(), []);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key).sort()).toEqual(["log-1:w1", "log-2:w1"]);
  });

  it("resolves the most recent export record per row and ignores older ones", () => {
    const logs = [
      log({ id: "log-1", metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "Jue 02 Jul", from: null, to: "10:00-18:00" }] }) }),
    ];

    const exportRecords: ExportRecordInput[] = [
      { auditLogId: "log-1", workerId: "w1", exportedAt: new Date("2026-07-02T09:00:00Z"), exportedBy: "admin1@pompeyo.cl" },
      { auditLogId: "log-1", workerId: "w1", exportedAt: new Date("2026-07-03T09:00:00Z"), exportedBy: "admin2@pompeyo.cl" },
    ];

    const rows = buildCambioRows(logs, new Map(), exportRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].fechaDescarga).toBe("2026-07-03T09:00:00.000Z");
    expect(rows[0].descargadoPor).toBe("admin2@pompeyo.cl");
  });

  it("skips logs without metadata or without a changes array", () => {
    const logs = [
      log({ id: "log-1", metadata: null }),
      log({ id: "log-2", metadata: JSON.stringify({ teamId: "t1" }) }),
      log({ id: "log-3", metadata: "not json" }),
    ];

    expect(buildCambioRows(logs, new Map(), [])).toEqual([]);
  });

  it("collapses saves with identical content for the same worker, keeping the latest", () => {
    const sameChange = { workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "Jue 02 Jul", from: null, to: "10:00-18:00" };
    const logs = [
      log({ id: "log-1", createdAt: new Date("2026-07-03T14:42:00Z"), metadata: JSON.stringify({ changes: [sameChange] }) }),
      log({ id: "log-2", createdAt: new Date("2026-07-03T14:43:00Z"), metadata: JSON.stringify({ changes: [sameChange] }) }),
      log({ id: "log-3", createdAt: new Date("2026-07-03T14:50:00Z"), metadata: JSON.stringify({ changes: [sameChange] }) }),
    ];

    const rows = buildCambioRows(logs, new Map(), []);

    expect(rows).toHaveLength(1);
    expect(rows[0].auditLogId).toBe("log-3"); // el guardado mas reciente sobrevive
  });

  it("does not collapse saves with different content for the same worker", () => {
    const logs = [
      log({ id: "log-1", metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "x", from: null, to: "10:00-18:00" }] }) }),
      log({ id: "log-2", metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "x", from: null, to: "09:00-17:00" }] }) }),
    ];

    const rows = buildCambioRows(logs, new Map(), []);
    expect(rows).toHaveLength(2);
  });

  it("keeps the download status when a duplicate save was the one actually downloaded", () => {
    const sameChange = { workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "x", from: null, to: "10:00-18:00" };
    const logs = [
      log({ id: "log-1", createdAt: new Date("2026-07-03T14:42:00Z"), metadata: JSON.stringify({ changes: [sameChange] }) }),
      log({ id: "log-2", createdAt: new Date("2026-07-03T14:50:00Z"), metadata: JSON.stringify({ changes: [sameChange] }) }),
    ];
    const exportRecords: ExportRecordInput[] = [
      { auditLogId: "log-1", workerId: "w1", exportedAt: new Date("2026-07-03T15:00:00Z"), exportedBy: "prieto.danilo94@gmail.com" },
    ];

    const rows = buildCambioRows(logs, new Map(), exportRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].auditLogId).toBe("log-2");
    expect(rows[0].fechaDescarga).toBe("2026-07-03T15:00:00.000Z");
    expect(rows[0].descargadoPor).toBe("prieto.danilo94@gmail.com");
  });

  it("sorts rows by fechaMod descending", () => {
    const logs = [
      log({ id: "log-old", createdAt: new Date("2026-07-01T10:00:00Z"), metadata: JSON.stringify({ changes: [{ workerId: "w1", workerName: "Ana", date: "2026-07-02", dayLabel: "x", from: null, to: "1" }] }) }),
      log({ id: "log-new", createdAt: new Date("2026-07-05T10:00:00Z"), metadata: JSON.stringify({ changes: [{ workerId: "w2", workerName: "Beto", date: "2026-07-02", dayLabel: "x", from: null, to: "1" }] }) }),
    ];

    const rows = buildCambioRows(logs, new Map(), []);
    expect(rows.map((r) => r.auditLogId)).toEqual(["log-new", "log-old"]);
  });
});
