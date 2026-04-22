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

  console.log("\n=== bootstrap completado ===\n");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
