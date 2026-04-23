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
const DB = process.env.APPWRITE_DATABASE_ID!; // main-v2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── helpers (mismo patrón que v1) ───────────────────────────────────────────

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

// Crea la DB si no existe (igual que v1)
async function ensureDatabase(): Promise<void> {
  try {
    await db.get(DB);
    console.log(`↷ database '${DB}' ya existía, skip`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 404) {
      await db.create(DB, "Shift Optimizer v2");
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

// ─── colección: area_catalog ─────────────────────────────────────────────────

async function bootstrapAreaCatalog(): Promise<void> {
  console.log("\n[area_catalog]");
  await ensureCollection("area_catalog", "Area Catalog", [
    Permission.read(Role.any()),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("area_catalog");
  await create("nombre_display", attrs, () =>
    db.createStringAttribute(DB, "area_catalog", "nombre_display", 255, true)
  );
  await create("clasificacion", attrs, () =>
    db.createEnumAttribute(
      DB,
      "area_catalog",
      "clasificacion",
      ["standalone", "mall_sin_dom", "mall_7d", "mall_autopark"],
      true
    )
  );
  await create("tipo_franja", attrs, () =>
    db.createEnumAttribute(
      DB,
      "area_catalog",
      "tipo_franja",
      ["standalone", "autopark", "movicenter", "tqaoev", "sur"],
      true
    )
  );
  await create("comuna", attrs, () =>
    db.createStringAttribute(DB, "area_catalog", "comuna", 100, true)
  );

  await sleep(2000);

  const idxs = await getExistingIdxKeys("area_catalog");
  await create("idx_clasificacion", idxs, () =>
    db.createIndex(DB, "area_catalog", "idx_clasificacion", IndexType.Key, ["clasificacion"])
  );
  await create("idx_tipo_franja", idxs, () =>
    db.createIndex(DB, "area_catalog", "idx_tipo_franja", IndexType.Key, ["tipo_franja"])
  );
}

// ─── colección: users ────────────────────────────────────────────────────────

async function bootstrapUsers(): Promise<void> {
  console.log("\n[users]");
  await ensureCollection("users", "Users", [
    Permission.read(Role.label("admin")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("users");
  await create("email", attrs, () => db.createEmailAttribute(DB, "users", "email", true));
  await create("nombre_completo", attrs, () => db.createStringAttribute(DB, "users", "nombre_completo", 255, true));
  await create("rut", attrs, () => db.createStringAttribute(DB, "users", "rut", 20, false));
  await create("rol", attrs, () => db.createEnumAttribute(DB, "users", "rol", ["admin", "jefe_sucursal"], true));
  await create("activo", attrs, () => db.createBooleanAttribute(DB, "users", "activo", false, true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("users");
  await create("idx_email_unique", idxs, () => db.createIndex(DB, "users", "idx_email_unique", IndexType.Unique, ["email"]));
  await create("idx_rol", idxs, () => db.createIndex(DB, "users", "idx_rol", IndexType.Key, ["rol"]));
}

// ─── colección: branch_managers ─────────────────────────────────────────────

async function bootstrapBranchManagers(): Promise<void> {
  console.log("\n[branch_managers]");
  await ensureCollection("branch_managers", "Branch Managers", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("branch_managers");
  await create("user_id", attrs, () => db.createStringAttribute(DB, "branch_managers", "user_id", 36, true));
  await create("branch_id", attrs, () => db.createStringAttribute(DB, "branch_managers", "branch_id", 36, true));
  await create("asignado_desde", attrs, () => db.createDatetimeAttribute(DB, "branch_managers", "asignado_desde", true));
  await create("asignado_hasta", attrs, () => db.createDatetimeAttribute(DB, "branch_managers", "asignado_hasta", false));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("branch_managers");
  await create("idx_user_branch_unique", idxs, () =>
    db.createIndex(DB, "branch_managers", "idx_user_branch_unique", IndexType.Unique, ["user_id", "branch_id"])
  );
}

// ─── colección: branches ──────────────────────────────────────────────────────

async function bootstrapBranches(): Promise<void> {
  console.log("\n[branches]");
  await ensureCollection("branches", "Branches", [
    Permission.read(Role.any()), // Todos pueden ver sucursales
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("branches");
  await create("codigo_area", attrs, () => db.createStringAttribute(DB, "branches", "codigo_area", 20, true));
  await create("nombre", attrs, () => db.createStringAttribute(DB, "branches", "nombre", 255, true));
  await create("tipo_franja", attrs, () =>
    db.createEnumAttribute(
      DB,
      "branches",
      "tipo_franja",
      ["standalone", "autopark", "movicenter", "tqaoev", "sur"],
      true
    )
  );
  await create("clasificacion", attrs, () =>
    db.createEnumAttribute(
      DB,
      "branches",
      "clasificacion",
      ["standalone", "mall_sin_dom", "mall_7d", "mall_autopark"],
      false // opcional por si no logramos clasificarla en la subida, se hará después
    )
  );
  await create("activa", attrs, () => db.createBooleanAttribute(DB, "branches", "activa", false, true));
  await create("creada_desde_excel", attrs, () => db.createBooleanAttribute(DB, "branches", "creada_desde_excel", false, true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("branches");
  await create("idx_codigo_unique", idxs, () => db.createIndex(DB, "branches", "idx_codigo_unique", IndexType.Unique, ["codigo_area"]));
}

// ——— colección: branch_type_config ————————————————————————————————————————————————

async function bootstrapBranchTypeConfig(): Promise<void> {
  console.log("\n[branch_type_config]");
  await ensureCollection("branch_type_config", "Branch Type Config", [
    Permission.read(Role.any()),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("branch_type_config");
  await create("nombre_display", attrs, () =>
    db.createStringAttribute(DB, "branch_type_config", "nombre_display", 100, true)
  );
  await create("franja_por_dia", attrs, () =>
    db.createStringAttribute(DB, "branch_type_config", "franja_por_dia", 8192, true)
  );
  await create("shifts_aplicables", attrs, () =>
    db.createStringAttribute(DB, "branch_type_config", "shifts_aplicables", 100, false, undefined, true)
  );
}

// ─── colección: workers ───────────────────────────────────────────────────────

async function bootstrapWorkers(): Promise<void> {
  console.log("\n[workers]");
  await ensureCollection("workers", "Workers", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("workers");
  await create("rut", attrs, () => db.createStringAttribute(DB, "workers", "rut", 20, true));
  await create("nombre_completo", attrs, () => db.createStringAttribute(DB, "workers", "nombre_completo", 255, true));
  await create("branch_id", attrs, () => db.createStringAttribute(DB, "workers", "branch_id", 36, true));
  await create("area_negocio", attrs, () =>
    db.createEnumAttribute(
      DB,
      "workers",
      "area_negocio",
      ["ventas", "postventa"],
      true
    )
  );
  await create("rotation_group", attrs, () => db.createStringAttribute(DB, "workers", "rotation_group", 50, true));
  await create("supervisor_nombre", attrs, () => db.createStringAttribute(DB, "workers", "supervisor_nombre", 255, false));
  await create("activo", attrs, () => db.createBooleanAttribute(DB, "workers", "activo", false, true));
  await create("ultima_sync_excel", attrs, () => db.createDatetimeAttribute(DB, "workers", "ultima_sync_excel", false));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("workers");
  await create("idx_rut_unique", idxs, () => db.createIndex(DB, "workers", "idx_rut_unique", IndexType.Unique, ["rut"]));
  await create("idx_branch", idxs, () => db.createIndex(DB, "workers", "idx_branch", IndexType.Key, ["branch_id"]));
}

// ——— colección: holidays ————————————————————————————————————————————————————————————

async function bootstrapHolidays(): Promise<void> {
  console.log("\n[holidays]");
  await ensureCollection("holidays", "Holidays", [
    Permission.read(Role.any()),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("holidays");
  await create("fecha", attrs, () => db.createDatetimeAttribute(DB, "holidays", "fecha", true));
  await create("nombre", attrs, () => db.createStringAttribute(DB, "holidays", "nombre", 255, true));
  await create("tipo", attrs, () => db.createEnumAttribute(DB, "holidays", "tipo", ["irrenunciable"], true));
  await create("anio", attrs, () => db.createIntegerAttribute(DB, "holidays", "anio", true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("holidays");
  await create("idx_fecha_unique", idxs, () =>
    db.createIndex(DB, "holidays", "idx_fecha_unique", IndexType.Unique, ["fecha"])
  );
  await create("idx_anio", idxs, () =>
    db.createIndex(DB, "holidays", "idx_anio", IndexType.Key, ["anio"])
  );
}

// ——— colección: worker_constraints ————————————————————————————————————————————————

async function bootstrapWorkerConstraints(): Promise<void> {
  console.log("\n[worker_constraints]");
  await ensureCollection("worker_constraints", "Worker Constraints", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("worker_constraints");
  await create("worker_id", attrs, () => db.createStringAttribute(DB, "worker_constraints", "worker_id", 36, true));
  await create("tipo", attrs, () =>
    db.createEnumAttribute(
      DB,
      "worker_constraints",
      "tipo",
      ["dia_prohibido", "turno_prohibido", "vacaciones"],
      true
    )
  );
  await create("valor", attrs, () => db.createStringAttribute(DB, "worker_constraints", "valor", 100, false));
  await create("fecha_desde", attrs, () => db.createDatetimeAttribute(DB, "worker_constraints", "fecha_desde", false));
  await create("fecha_hasta", attrs, () => db.createDatetimeAttribute(DB, "worker_constraints", "fecha_hasta", false));
  await create("notas", attrs, () => db.createStringAttribute(DB, "worker_constraints", "notas", 1000, false));
  await create("creado_por", attrs, () => db.createStringAttribute(DB, "worker_constraints", "creado_por", 36, true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("worker_constraints");
  await create("idx_worker_id", idxs, () =>
    db.createIndex(DB, "worker_constraints", "idx_worker_id", IndexType.Key, ["worker_id"])
  );
  await create("idx_tipo", idxs, () =>
    db.createIndex(DB, "worker_constraints", "idx_tipo", IndexType.Key, ["tipo"])
  );
}

// ——— colección: proposals —————————————————————————————————————————————————————————

async function bootstrapProposals(): Promise<void> {
  console.log("\n[proposals]");
  await ensureCollection("proposals", "Proposals", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.update(Role.label("jefesucursal")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("proposals");
  await create("branch_id", attrs, () => db.createStringAttribute(DB, "proposals", "branch_id", 36, true));
  await create("anio", attrs, () => db.createIntegerAttribute(DB, "proposals", "anio", true));
  await create("mes", attrs, () => db.createIntegerAttribute(DB, "proposals", "mes", true, 1, 12));
  await create("modo", attrs, () => db.createEnumAttribute(DB, "proposals", "modo", ["ilp", "greedy"], true));
  await create("score", attrs, () => db.createFloatAttribute(DB, "proposals", "score", true));
  await create("factible", attrs, () => db.createBooleanAttribute(DB, "proposals", "factible", true));
  await create("asignaciones", attrs, () => db.createStringAttribute(DB, "proposals", "asignaciones", 65535, true));
  await create("dotacion_sugerida", attrs, () => db.createIntegerAttribute(DB, "proposals", "dotacion_sugerida", true));
  await create("parametros", attrs, () => db.createStringAttribute(DB, "proposals", "parametros", 4096, true));
  await create("estado", attrs, () =>
    db.createEnumAttribute(
      DB,
      "proposals",
      "estado",
      ["generada", "publicada", "seleccionada", "exportada", "descartada"],
      true
    )
  );
  await create("creada_por", attrs, () => db.createStringAttribute(DB, "proposals", "creada_por", 36, true));
  await create("seleccionada_por", attrs, () => db.createStringAttribute(DB, "proposals", "seleccionada_por", 36, false));
  await create("metrics", attrs, () => db.createStringAttribute(DB, "proposals", "metrics", 4096, false));
  await create("publicada_por", attrs, () => db.createStringAttribute(DB, "proposals", "publicada_por", 36, false));
  await create("publicada_en", attrs, () => db.createDatetimeAttribute(DB, "proposals", "publicada_en", false));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("proposals");
  await create("idx_branch_anio_mes", idxs, () =>
    db.createIndex(DB, "proposals", "idx_branch_anio_mes", IndexType.Key, ["branch_id", "anio", "mes"])
  );
  await create("idx_estado", idxs, () =>
    db.createIndex(DB, "proposals", "idx_estado", IndexType.Key, ["estado"])
  );
}

// ——— colección: assignments ——————————————————————————————————————————————————————

async function bootstrapAssignments(): Promise<void> {
  console.log("\n[assignments]");
  await ensureCollection("assignments", "Assignments", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.create(Role.label("jefesucursal")),
    Permission.update(Role.label("admin")),
    Permission.update(Role.label("jefesucursal")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("assignments");
  await create("proposal_id", attrs, () => db.createStringAttribute(DB, "assignments", "proposal_id", 36, true));
  await create("slot_numero", attrs, () => db.createIntegerAttribute(DB, "assignments", "slot_numero", true));
  await create("worker_id", attrs, () => db.createStringAttribute(DB, "assignments", "worker_id", 36, false));
  await create("asignado_por", attrs, () => db.createStringAttribute(DB, "assignments", "asignado_por", 36, false));
  await create("asignado_en", attrs, () => db.createDatetimeAttribute(DB, "assignments", "asignado_en", false));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("assignments");
  await create("idx_proposal_id", idxs, () =>
    db.createIndex(DB, "assignments", "idx_proposal_id", IndexType.Key, ["proposal_id"])
  );
  await create("idx_proposal_slot_unique", idxs, () =>
    db.createIndex(DB, "assignments", "idx_proposal_slot_unique", IndexType.Unique, ["proposal_id", "slot_numero"])
  );
}

// --- coleccion: slot_overrides ------------------------------------------------

async function bootstrapSlotOverrides(): Promise<void> {
  console.log("\n[slot_overrides]");
  await ensureCollection("slot_overrides", "Slot Overrides", [
    Permission.read(Role.label("admin")),
    Permission.read(Role.label("jefesucursal")),
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("slot_overrides");
  await create("proposal_id", attrs, () => db.createStringAttribute(DB, "slot_overrides", "proposal_id", 36, true));
  await create("fecha", attrs, () => db.createStringAttribute(DB, "slot_overrides", "fecha", 10, true));
  await create("slot_numero", attrs, () => db.createIntegerAttribute(DB, "slot_overrides", "slot_numero", false));
  await create("tipo", attrs, () =>
    db.createEnumAttribute(
      DB,
      "slot_overrides",
      "tipo",
      ["cambiar_turno", "marcar_libre", "marcar_trabajado", "proteger_domingo"],
      true
    )
  );
  await create("shift_id_original", attrs, () => db.createStringAttribute(DB, "slot_overrides", "shift_id_original", 100, false));
  await create("shift_id_nuevo", attrs, () => db.createStringAttribute(DB, "slot_overrides", "shift_id_nuevo", 100, false));
  await create("notas", attrs, () => db.createStringAttribute(DB, "slot_overrides", "notas", 1000, false));
  await create("creado_por", attrs, () => db.createStringAttribute(DB, "slot_overrides", "creado_por", 36, true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("slot_overrides");
  await create("idx_override_proposal", idxs, () =>
    db.createIndex(DB, "slot_overrides", "idx_override_proposal", IndexType.Key, ["proposal_id"])
  );
  await create("idx_override_fecha", idxs, () =>
    db.createIndex(DB, "slot_overrides", "idx_override_fecha", IndexType.Key, ["fecha"])
  );
}

// ─── colección: audit_log ─────────────────────────────────────────────────────

async function bootstrapAuditLog(): Promise<void> {
  console.log("\n[audit_log]");
  await ensureCollection("audit_log", "Audit Log", [
    Permission.read(Role.label("admin")),
    Permission.create(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("audit_log");
  await create("user_id", attrs, () => db.createStringAttribute(DB, "audit_log", "user_id", 36, true));
  await create("accion", attrs, () => db.createStringAttribute(DB, "audit_log", "accion", 50, true));
  await create("entidad", attrs, () => db.createStringAttribute(DB, "audit_log", "entidad", 50, true));
  await create("metadata", attrs, () => db.createStringAttribute(DB, "audit_log", "metadata", 10000, false));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("audit_log");
  await create("idx_accion", idxs, () => db.createIndex(DB, "audit_log", "idx_accion", IndexType.Key, ["accion"]));
}

// ─── colección: shift_catalog_v2 ────────────────────────────────────────────────

async function bootstrapShiftCatalogV2(): Promise<void> {
  console.log("\n[shift_catalog_v2]");
  await ensureCollection("shift_catalog_v2", "Shift Catalog v2", [
    Permission.read(Role.any()), // Todos pueden ver los turnos
    Permission.create(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ]);

  const attrs = await getExistingAttrKeys("shift_catalog_v2");
  await create("rotation_group", attrs, () => db.createStringAttribute(DB, "shift_catalog_v2", "rotation_group", 50, true));
  await create("nombre_turno", attrs, () => db.createStringAttribute(DB, "shift_catalog_v2", "nombre_turno", 50, true));
  await create("nombre_display", attrs, () => db.createStringAttribute(DB, "shift_catalog_v2", "nombre_display", 100, true));
  await create("horario_por_dia", attrs, () => db.createStringAttribute(DB, "shift_catalog_v2", "horario_por_dia", 10000, true));
  await create("descuenta_colacion", attrs, () => db.createBooleanAttribute(DB, "shift_catalog_v2", "descuenta_colacion", false, true));
  
  // Appwrite array of strings support
  await create("dias_aplicables", attrs, () => db.createStringAttribute(DB, "shift_catalog_v2", "dias_aplicables", 20, true, undefined, true));

  await sleep(2000);

  const idxs = await getExistingIdxKeys("shift_catalog_v2");
  await create("idx_grupo_rotacion", idxs, () => db.createIndex(DB, "shift_catalog_v2", "idx_grupo_rotacion", IndexType.Key, ["rotation_group"]));
}

// ——— permisos por rol ————————————————————————————————————————————————————————————

const ADMIN = Role.label("admin");
const JEFE = Role.label("jefesucursal");

async function setCollectionPerms(
  id: string,
  name: string,
  permissions: string[],
  documentSecurity: boolean
): Promise<void> {
  await db.updateCollection(DB, id, name, permissions, documentSecurity);
  console.log(`  ✓ ${id}`);
}

async function configurePermissions(): Promise<void> {
  console.log("\n[permisos por rol]");

  await setCollectionPerms("area_catalog", "Area Catalog", [
    Permission.read(Role.any()),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("users", "Users", [
    Permission.read(ADMIN),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], true);

  await setCollectionPerms("branch_managers", "Branch Managers", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("branches", "Branches", [
    Permission.read(Role.users()),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("branch_type_config", "Branch Type Config", [
    Permission.read(Role.any()),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("workers", "Workers", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("holidays", "Holidays", [
    Permission.read(Role.any()),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("worker_constraints", "Worker Constraints", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("audit_log", "Audit Log", [
    Permission.read(ADMIN),
    Permission.create(ADMIN),
  ], false);

  await setCollectionPerms("shift_catalog_v2", "Shift Catalog v2", [
    Permission.read(Role.any()),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("proposals", "Proposals", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.update(JEFE),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("assignments", "Assignments", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.create(JEFE),
    Permission.update(ADMIN),
    Permission.update(JEFE),
    Permission.delete(ADMIN),
  ], false);

  await setCollectionPerms("slot_overrides", "Slot Overrides", [
    Permission.read(ADMIN),
    Permission.read(JEFE),
    Permission.create(ADMIN),
    Permission.update(ADMIN),
    Permission.delete(ADMIN),
  ], false);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== bootstrap-appwrite-v2 ===");
  console.log(`endpoint : ${process.env.APPWRITE_ENDPOINT}`);
  console.log(`project  : ${process.env.APPWRITE_PROJECT_ID}`);
  console.log(`database : ${DB}`);
  console.log();

  await ensureDatabase();
  await bootstrapAreaCatalog();
  await bootstrapUsers();
  await bootstrapBranchManagers();
  await bootstrapBranches();
  await bootstrapBranchTypeConfig();
  await bootstrapWorkers();
  await bootstrapHolidays();
  await bootstrapWorkerConstraints();
  await bootstrapProposals();
  await bootstrapAssignments();
  await bootstrapSlotOverrides();
  await bootstrapAuditLog();
  await bootstrapShiftCatalogV2();
  await configurePermissions();

  console.log("\n=== bootstrap completado ===\n");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
