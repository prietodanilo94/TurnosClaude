import "dotenv/config";
import {
  Client,
  Databases,
  Permission,
  Role,
  IndexType,
  AppwriteException,
  Query,
} from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getExistingAttrKeys(collId: string): Promise<Set<string>> {
  const list = await db.listAttributes(DB, collId, [Query.limit(100)]);
  return new Set(list.attributes.map((a: any) => a.key));
}

async function getExistingIdxKeys(collId: string): Promise<Set<string>> {
  const list = await db.listIndexes(DB, collId, [Query.limit(100)]);
  return new Set(list.indexes.map((i: any) => i.key));
}

async function create(
  key: string,
  existing: Set<string>,
  fn: () => Promise<unknown>
): Promise<void> {
  if (existing.has(key)) {
    console.log(`    ↷ ${key} ya existía, skip`);
    return;
  }
  await fn();
  console.log(`    ✓ ${key}`);
}

async function ensureDatabase(): Promise<void> {
  try {
    await db.get(DB);
    console.log(`↷ database '${DB}' ya existía, skip`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 404) {
      await db.create(DB, "Shift Optimizer");
      console.log(`✓ creada database '${DB}'`);
    } else {
      throw e;
    }
  }
}

async function ensureCollection(
  id: string,
  name: string,
  permissions: string[]
): Promise<void> {
  try {
    await db.getCollection(DB, id);
    console.log(`↷ colección '${id}' ya existía, skip`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 404) {
      await db.createCollection(DB, id, name, permissions, false);
      console.log(`✓ creada colección '${id}'`);
    } else {
      throw e;
    }
  }
}

// ─── users ──────────────────────────────────────────────────────────────────

async function bootstrapUsers(): Promise<void> {
  console.log("\n[users]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("users", "Users", perms);

  const attrs = await getExistingAttrKeys("users");
  await create("email", attrs, () =>
    db.createEmailAttribute(DB, "users", "email", true)
  );
  await create("nombre_completo", attrs, () =>
    db.createStringAttribute(DB, "users", "nombre_completo", 255, true)
  );
  await create("rut", attrs, () =>
    db.createStringAttribute(DB, "users", "rut", 20, false)
  );
  await create("rol", attrs, () =>
    db.createEnumAttribute(DB, "users", "rol", ["admin", "jefe_sucursal"], true)
  );
  // required=false para poder definir default=true (Appwrite 1.6 no permite default en required)
  await create("activo", attrs, () =>
    db.createBooleanAttribute(DB, "users", "activo", false, true)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("users");
  await create("idx_email_unique", idxs, () =>
    db.createIndex(DB, "users", "idx_email_unique", IndexType.Unique, ["email"])
  );
  await create("idx_rol", idxs, () =>
    db.createIndex(DB, "users", "idx_rol", IndexType.Key, ["rol"])
  );
}

// ─── branches ────────────────────────────────────────────────────────────────

async function bootstrapBranches(): Promise<void> {
  console.log("\n[branches]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("branches", "Branches", perms);

  const attrs = await getExistingAttrKeys("branches");
  await create("codigo_area", attrs, () =>
    db.createStringAttribute(DB, "branches", "codigo_area", 20, true)
  );
  await create("nombre", attrs, () =>
    db.createStringAttribute(DB, "branches", "nombre", 255, true)
  );
  await create("tipo_franja", attrs, () =>
    db.createEnumAttribute(
      DB,
      "branches",
      "tipo_franja",
      ["standalone", "autopark", "movicenter", "tqaoev", "sur"],
      true
    )
  );
  await create("activa", attrs, () =>
    db.createBooleanAttribute(DB, "branches", "activa", false, true)
  );
  await create("creada_desde_excel", attrs, () =>
    db.createBooleanAttribute(DB, "branches", "creada_desde_excel", false, false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("branches");
  await create("idx_codigo_area_unique", idxs, () =>
    db.createIndex(
      DB,
      "branches",
      "idx_codigo_area_unique",
      IndexType.Unique,
      ["codigo_area"]
    )
  );
  await create("idx_tipo_franja", idxs, () =>
    db.createIndex(DB, "branches", "idx_tipo_franja", IndexType.Key, ["tipo_franja"])
  );
}

// ─── branch_type_config ───────────────────────────────────────────────────────

async function bootstrapBranchTypeConfig(): Promise<void> {
  console.log("\n[branch_type_config]");
  const perms = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("branch_type_config", "Branch Type Config", perms);

  const attrs = await getExistingAttrKeys("branch_type_config");
  await create("nombre_display", attrs, () =>
    db.createStringAttribute(DB, "branch_type_config", "nombre_display", 100, true)
  );
  // JSON serializado como string — sin restricción de tamaño por documento
  await create("franja_por_dia", attrs, () =>
    db.createStringAttribute(DB, "branch_type_config", "franja_por_dia", 8192, true)
  );
  // Array de IDs de shift_catalog
  await create("shifts_aplicables", attrs, () =>
    db.createStringAttribute(
      DB,
      "branch_type_config",
      "shifts_aplicables",
      100,
      false,
      undefined,
      true
    )
  );
}

// ─── shift_catalog ────────────────────────────────────────────────────────────

async function bootstrapShiftCatalog(): Promise<void> {
  console.log("\n[shift_catalog]");
  const perms = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("shift_catalog", "Shift Catalog", perms);

  const attrs = await getExistingAttrKeys("shift_catalog");
  await create("nombre_display", attrs, () =>
    db.createStringAttribute(DB, "shift_catalog", "nombre_display", 100, true)
  );
  await create("hora_inicio", attrs, () =>
    db.createStringAttribute(DB, "shift_catalog", "hora_inicio", 5, true)
  );
  await create("hora_fin", attrs, () =>
    db.createStringAttribute(DB, "shift_catalog", "hora_fin", 5, true)
  );
  await create("duracion_minutos", attrs, () =>
    db.createIntegerAttribute(DB, "shift_catalog", "duracion_minutos", true)
  );
  await create("descuenta_colacion", attrs, () =>
    db.createBooleanAttribute(DB, "shift_catalog", "descuenta_colacion", true)
  );
  await create("categoria", attrs, () =>
    db.createEnumAttribute(
      DB,
      "shift_catalog",
      "categoria",
      ["principal", "adicional"],
      true
    )
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("shift_catalog");
  await create("idx_categoria", idxs, () =>
    db.createIndex(DB, "shift_catalog", "idx_categoria", IndexType.Key, ["categoria"])
  );
}

// ─── workers ─────────────────────────────────────────────────────────────────

async function bootstrapWorkers(): Promise<void> {
  console.log("\n[workers]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("workers", "Workers", perms);

  const attrs = await getExistingAttrKeys("workers");
  await create("rut", attrs, () =>
    db.createStringAttribute(DB, "workers", "rut", 20, true)
  );
  await create("nombre_completo", attrs, () =>
    db.createStringAttribute(DB, "workers", "nombre_completo", 255, true)
  );
  await create("branch_id", attrs, () =>
    db.createStringAttribute(DB, "workers", "branch_id", 36, true)
  );
  await create("supervisor_nombre", attrs, () =>
    db.createStringAttribute(DB, "workers", "supervisor_nombre", 255, false)
  );
  await create("activo", attrs, () =>
    db.createBooleanAttribute(DB, "workers", "activo", false, true)
  );
  await create("ultima_sync_excel", attrs, () =>
    db.createDatetimeAttribute(DB, "workers", "ultima_sync_excel", false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("workers");
  await create("idx_rut_unique", idxs, () =>
    db.createIndex(DB, "workers", "idx_rut_unique", IndexType.Unique, ["rut"])
  );
  await create("idx_branch_id", idxs, () =>
    db.createIndex(DB, "workers", "idx_branch_id", IndexType.Key, ["branch_id"])
  );
  await create("idx_activo", idxs, () =>
    db.createIndex(DB, "workers", "idx_activo", IndexType.Key, ["activo"])
  );
}

// ─── branch_managers ─────────────────────────────────────────────────────────

async function bootstrapBranchManagers(): Promise<void> {
  console.log("\n[branch_managers]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("branch_managers", "Branch Managers", perms);

  const attrs = await getExistingAttrKeys("branch_managers");
  await create("user_id", attrs, () =>
    db.createStringAttribute(DB, "branch_managers", "user_id", 36, true)
  );
  await create("branch_id", attrs, () =>
    db.createStringAttribute(DB, "branch_managers", "branch_id", 36, true)
  );
  await create("asignado_desde", attrs, () =>
    db.createDatetimeAttribute(DB, "branch_managers", "asignado_desde", true)
  );
  await create("asignado_hasta", attrs, () =>
    db.createDatetimeAttribute(DB, "branch_managers", "asignado_hasta", false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("branch_managers");
  await create("idx_user_id", idxs, () =>
    db.createIndex(DB, "branch_managers", "idx_user_id", IndexType.Key, ["user_id"])
  );
  await create("idx_branch_id", idxs, () =>
    db.createIndex(DB, "branch_managers", "idx_branch_id", IndexType.Key, ["branch_id"])
  );
  // Compound unique — lógica de "solo vigentes" se maneja en app
  await create("idx_user_branch_unique", idxs, () =>
    db.createIndex(
      DB,
      "branch_managers",
      "idx_user_branch_unique",
      IndexType.Unique,
      ["user_id", "branch_id"]
    )
  );
}

// ─── holidays ─────────────────────────────────────────────────────────────────

async function bootstrapHolidays(): Promise<void> {
  console.log("\n[holidays]");
  const perms = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("holidays", "Holidays", perms);

  const attrs = await getExistingAttrKeys("holidays");
  await create("fecha", attrs, () =>
    db.createDatetimeAttribute(DB, "holidays", "fecha", true)
  );
  await create("nombre", attrs, () =>
    db.createStringAttribute(DB, "holidays", "nombre", 255, true)
  );
  await create("tipo", attrs, () =>
    db.createEnumAttribute(DB, "holidays", "tipo", ["irrenunciable"], true)
  );
  await create("anio", attrs, () =>
    db.createIntegerAttribute(DB, "holidays", "anio", true)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("holidays");
  await create("idx_fecha_unique", idxs, () =>
    db.createIndex(DB, "holidays", "idx_fecha_unique", IndexType.Unique, ["fecha"])
  );
  await create("idx_anio", idxs, () =>
    db.createIndex(DB, "holidays", "idx_anio", IndexType.Key, ["anio"])
  );
}

// ─── worker_constraints ───────────────────────────────────────────────────────

async function bootstrapWorkerConstraints(): Promise<void> {
  console.log("\n[worker_constraints]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("worker_constraints", "Worker Constraints", perms);

  const attrs = await getExistingAttrKeys("worker_constraints");
  await create("worker_id", attrs, () =>
    db.createStringAttribute(DB, "worker_constraints", "worker_id", 36, true)
  );
  await create("tipo", attrs, () =>
    db.createEnumAttribute(
      DB,
      "worker_constraints",
      "tipo",
      ["dia_prohibido", "turno_prohibido", "vacaciones"],
      true
    )
  );
  await create("valor", attrs, () =>
    db.createStringAttribute(DB, "worker_constraints", "valor", 100, false)
  );
  await create("fecha_desde", attrs, () =>
    db.createDatetimeAttribute(DB, "worker_constraints", "fecha_desde", false)
  );
  await create("fecha_hasta", attrs, () =>
    db.createDatetimeAttribute(DB, "worker_constraints", "fecha_hasta", false)
  );
  await create("notas", attrs, () =>
    db.createStringAttribute(DB, "worker_constraints", "notas", 1000, false)
  );
  await create("creado_por", attrs, () =>
    db.createStringAttribute(DB, "worker_constraints", "creado_por", 36, true)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("worker_constraints");
  await create("idx_worker_id", idxs, () =>
    db.createIndex(DB, "worker_constraints", "idx_worker_id", IndexType.Key, ["worker_id"])
  );
  await create("idx_tipo", idxs, () =>
    db.createIndex(DB, "worker_constraints", "idx_tipo", IndexType.Key, ["tipo"])
  );
}

// ─── proposals ───────────────────────────────────────────────────────────────

async function bootstrapProposals(): Promise<void> {
  console.log("\n[proposals]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("proposals", "Proposals", perms);

  const attrs = await getExistingAttrKeys("proposals");
  await create("branch_id", attrs, () =>
    db.createStringAttribute(DB, "proposals", "branch_id", 36, true)
  );
  await create("anio", attrs, () =>
    db.createIntegerAttribute(DB, "proposals", "anio", true)
  );
  await create("mes", attrs, () =>
    db.createIntegerAttribute(DB, "proposals", "mes", true, 1, 12)
  );
  await create("modo", attrs, () =>
    db.createEnumAttribute(DB, "proposals", "modo", ["ilp", "greedy"], true)
  );
  await create("score", attrs, () =>
    db.createFloatAttribute(DB, "proposals", "score", true)
  );
  await create("factible", attrs, () =>
    db.createBooleanAttribute(DB, "proposals", "factible", true)
  );
  // Array de asignaciones serializado como JSON string
  await create("asignaciones", attrs, () =>
    db.createStringAttribute(DB, "proposals", "asignaciones", 65535, true)
  );
  await create("dotacion_sugerida", attrs, () =>
    db.createIntegerAttribute(DB, "proposals", "dotacion_sugerida", true)
  );
  // Parámetros del optimizador serializados como JSON string
  await create("parametros", attrs, () =>
    db.createStringAttribute(DB, "proposals", "parametros", 4096, true)
  );
  await create("estado", attrs, () =>
    db.createEnumAttribute(
      DB,
      "proposals",
      "estado",
      ["generada", "seleccionada", "descartada"],
      true
    )
  );
  await create("creada_por", attrs, () =>
    db.createStringAttribute(DB, "proposals", "creada_por", 36, true)
  );
  await create("seleccionada_por", attrs, () =>
    db.createStringAttribute(DB, "proposals", "seleccionada_por", 36, false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("proposals");
  await create("idx_branch_anio_mes", idxs, () =>
    db.createIndex(
      DB,
      "proposals",
      "idx_branch_anio_mes",
      IndexType.Key,
      ["branch_id", "anio", "mes"]
    )
  );
  await create("idx_estado", idxs, () =>
    db.createIndex(DB, "proposals", "idx_estado", IndexType.Key, ["estado"])
  );
}

// ─── assignments ─────────────────────────────────────────────────────────────

async function bootstrapAssignments(): Promise<void> {
  console.log("\n[assignments]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("assignments", "Assignments", perms);

  const attrs = await getExistingAttrKeys("assignments");
  await create("proposal_id", attrs, () =>
    db.createStringAttribute(DB, "assignments", "proposal_id", 36, true)
  );
  await create("slot_numero", attrs, () =>
    db.createIntegerAttribute(DB, "assignments", "slot_numero", true)
  );
  await create("worker_id", attrs, () =>
    db.createStringAttribute(DB, "assignments", "worker_id", 36, false)
  );
  await create("asignado_por", attrs, () =>
    db.createStringAttribute(DB, "assignments", "asignado_por", 36, false)
  );
  await create("asignado_en", attrs, () =>
    db.createDatetimeAttribute(DB, "assignments", "asignado_en", false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("assignments");
  await create("idx_proposal_id", idxs, () =>
    db.createIndex(DB, "assignments", "idx_proposal_id", IndexType.Key, ["proposal_id"])
  );
  await create("idx_proposal_slot_unique", idxs, () =>
    db.createIndex(
      DB,
      "assignments",
      "idx_proposal_slot_unique",
      IndexType.Unique,
      ["proposal_id", "slot_numero"]
    )
  );
}

// ─── audit_log ────────────────────────────────────────────────────────────────

async function bootstrapAuditLog(): Promise<void> {
  console.log("\n[audit_log]");
  const perms = [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  await ensureCollection("audit_log", "Audit Log", perms);

  const attrs = await getExistingAttrKeys("audit_log");
  await create("user_id", attrs, () =>
    db.createStringAttribute(DB, "audit_log", "user_id", 36, true)
  );
  await create("accion", attrs, () =>
    db.createStringAttribute(DB, "audit_log", "accion", 100, true)
  );
  await create("entidad", attrs, () =>
    db.createStringAttribute(DB, "audit_log", "entidad", 50, false)
  );
  await create("entidad_id", attrs, () =>
    db.createStringAttribute(DB, "audit_log", "entidad_id", 36, false)
  );
  // Contexto adicional serializado como JSON string
  await create("metadata", attrs, () =>
    db.createStringAttribute(DB, "audit_log", "metadata", 4096, false)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("audit_log");
  await create("idx_user_id", idxs, () =>
    db.createIndex(DB, "audit_log", "idx_user_id", IndexType.Key, ["user_id"])
  );
  await create("idx_accion", idxs, () =>
    db.createIndex(DB, "audit_log", "idx_accion", IndexType.Key, ["accion"])
  );
  await create("idx_created_at", idxs, () =>
    db.createIndex(DB, "audit_log", "idx_created_at", IndexType.Key, ["$createdAt"])
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== bootstrap-appwrite ===");
  console.log(`endpoint : ${process.env.APPWRITE_ENDPOINT}`);
  console.log(`project  : ${process.env.APPWRITE_PROJECT_ID}`);
  console.log(`database : ${DB}`);
  console.log();

  await ensureDatabase();
  await bootstrapUsers();
  await bootstrapBranches();
  await bootstrapBranchTypeConfig();
  await bootstrapShiftCatalog();
  await bootstrapWorkers();
  await bootstrapBranchManagers();
  await bootstrapHolidays();
  await bootstrapWorkerConstraints();
  await bootstrapProposals();
  await bootstrapAssignments();
  await bootstrapAuditLog();

  console.log("\n=== bootstrap completo ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
