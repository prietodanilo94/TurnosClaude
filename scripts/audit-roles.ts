import "dotenv/config";
import { Client, Databases, Users, Query, type Models } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const usersApi = new Users(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

// ─── helpers ─────────────────────────────────────────────────────────────────

const ROL_TO_LABEL: Record<string, string> = {
  admin: "admin",
  jefe_sucursal: "jefesucursal",
};

async function listAllAuthUsers(): Promise<Models.User<Models.Preferences>[]> {
  const all: Models.User<Models.Preferences>[] = [];
  let cursor: string | undefined;
  do {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await usersApi.list(queries);
    all.push(...page.users);
    cursor = page.users.length === 100 ? page.users.at(-1)!.$id : undefined;
  } while (cursor);
  return all;
}

async function listAllUserDocs(): Promise<Models.Document[]> {
  const all: Models.Document[] = [];
  let cursor: string | undefined;
  do {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await db.listDocuments(DB, "users", queries);
    all.push(...page.documents);
    cursor = page.documents.length === 100 ? page.documents.at(-1)!.$id : undefined;
  } while (cursor);
  return all;
}

async function listAllBranchManagers(): Promise<Models.Document[]> {
  const all: Models.Document[] = [];
  let cursor: string | undefined;
  do {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await db.listDocuments(DB, "branch_managers", queries);
    all.push(...page.documents);
    cursor = page.documents.length === 100 ? page.documents.at(-1)!.$id : undefined;
  } while (cursor);
  return all;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== audit-roles ===\n");

  const [authUsers, userDocs, branchManagers] = await Promise.all([
    listAllAuthUsers(),
    listAllUserDocs(),
    listAllBranchManagers(),
  ]);

  console.log(`Auth users       : ${authUsers.length}`);
  console.log(`users docs       : ${userDocs.length}`);
  console.log(`branch_managers  : ${branchManagers.length}`);
  console.log();

  const issues: string[] = [];
  const authById = new Map(authUsers.map((u) => [u.$id, u]));
  const docById = new Map(userDocs.map((d) => [d.$id, d]));

  // ── Check 1: Auth users con label conocido que no tienen doc en DB ──────────
  for (const au of authUsers) {
    const hasKnownLabel = au.labels.some((l) => Object.values(ROL_TO_LABEL).includes(l));
    if (!hasKnownLabel) continue; // usuarios sin rol asignado, skip

    if (!docById.has(au.$id)) {
      issues.push(
        `[AUTH→DB] ${au.email} (${au.$id}) tiene label [${au.labels.join(", ")}] pero NO tiene doc en colección users`
      );
    }
  }

  // ── Check 2: Docs en DB que no tienen Auth user ──────────────────────────────
  for (const doc of userDocs) {
    if (!authById.has(doc.$id)) {
      issues.push(
        `[DB→AUTH] ${doc.email} (${doc.$id}) tiene doc en users pero NO existe en Appwrite Auth`
      );
    }
  }

  // ── Check 3: Mismatch de rol (doc) vs label (Auth) ──────────────────────────
  for (const doc of userDocs) {
    const au = authById.get(doc.$id);
    if (!au) continue; // ya reportado en Check 2

    const expectedLabel = ROL_TO_LABEL[doc.rol as string];
    if (expectedLabel && !au.labels.includes(expectedLabel)) {
      issues.push(
        `[LABEL] ${doc.email} (${doc.$id}): doc.rol="${doc.rol}" pero labels Auth=[${au.labels.join(", ")}] (esperado label "${expectedLabel}")`
      );
    }
  }

  // ── Check 4: activo en DB vs status en Auth ──────────────────────────────────
  for (const doc of userDocs) {
    const au = authById.get(doc.$id);
    if (!au) continue;

    if (doc.activo === true && au.status === false) {
      issues.push(
        `[STATUS] ${doc.email} (${doc.$id}): doc.activo=true pero Auth.status=false (desactivado solo en Auth)`
      );
    }
    if (doc.activo === false && au.status === true) {
      issues.push(
        `[STATUS] ${doc.email} (${doc.$id}): doc.activo=false pero Auth.status=true (desactivado solo en DB)`
      );
    }
  }

  // ── Check 5: branch_managers con user_id que no existe ──────────────────────
  const jefeIds = new Set(
    userDocs.filter((d) => d.rol === "jefe_sucursal").map((d) => d.$id)
  );
  for (const bm of branchManagers) {
    if (!authById.has(bm.user_id)) {
      issues.push(
        `[BM→AUTH] branch_manager ${bm.$id} referencia user_id=${bm.user_id} que NO existe en Auth`
      );
    } else if (!jefeIds.has(bm.user_id)) {
      issues.push(
        `[BM→ROL] branch_manager ${bm.$id} referencia user_id=${bm.user_id} que NO es jefe_sucursal en DB`
      );
    }
  }

  // ── Resultado ────────────────────────────────────────────────────────────────
  if (issues.length === 0) {
    console.log("✅ Todo consistente — no se encontraron discrepancias.");
    process.exit(0);
  } else {
    console.log(`❌ Se encontraron ${issues.length} discrepancia(s):\n`);
    issues.forEach((msg) => console.log(`  • ${msg}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
