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

  console.log("\n=== bootstrap completo ===");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
