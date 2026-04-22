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

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== bootstrap-appwrite-v2 ===");
  console.log(`endpoint : ${process.env.APPWRITE_ENDPOINT}`);
  console.log(`project  : ${process.env.APPWRITE_PROJECT_ID}`);
  console.log(`database : ${DB}`);
  console.log();

  await ensureDatabase();
  await bootstrapAreaCatalog();

  console.log("\n=== bootstrap completado ===\n");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
