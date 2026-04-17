import { test, expect } from "@playwright/test";
import { Client, Databases, Users, ID, Query } from "node-appwrite";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

// Email único por ejecución para evitar colisiones
const JEFE_EMAIL = `e2e.jefe.${Date.now()}@example.com`;
const JEFE_PASSWORD = "TestJefe123!";
const JEFE_NOMBRE = "Jefe E2E Test";

type DocRef = { $id: string; nombre: string };
let branchA: DocRef;
let branchB: DocRef;
let branchC: DocRef;

function adminClient() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
  return {
    databases: new Databases(client),
    users: new Users(client),
  };
}

async function loginViaUI(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
}

test.describe("Auth E2E — admin crea jefe, jefe ve solo sus sucursales", () => {
  test.beforeAll(async () => {
    const { databases } = adminClient();

    branchA = (await databases.createDocument(DB_ID, "branches", ID.unique(), {
      codigo_area: "E2E-A",
      nombre: "Sucursal E2E Alpha",
      tipo_franja: "standalone",
      activa: true,
      creada_desde_excel: false,
    })) as unknown as DocRef;

    branchB = (await databases.createDocument(DB_ID, "branches", ID.unique(), {
      codigo_area: "E2E-B",
      nombre: "Sucursal E2E Beta",
      tipo_franja: "standalone",
      activa: true,
      creada_desde_excel: false,
    })) as unknown as DocRef;

    branchC = (await databases.createDocument(DB_ID, "branches", ID.unique(), {
      codigo_area: "E2E-C",
      nombre: "Sucursal E2E Gamma",
      tipo_franja: "standalone",
      activa: true,
      creada_desde_excel: false,
    })) as unknown as DocRef;
  });

  test.afterAll(async () => {
    const { databases, users } = adminClient();

    // Eliminar sucursales de prueba
    await databases.deleteDocument(DB_ID, "branches", branchA.$id).catch(() => {});
    await databases.deleteDocument(DB_ID, "branches", branchB.$id).catch(() => {});
    await databases.deleteDocument(DB_ID, "branches", branchC.$id).catch(() => {});

    // Buscar y eliminar jefe de prueba
    const result = await databases
      .listDocuments(DB_ID, "users", [Query.equal("email", JEFE_EMAIL)])
      .catch(() => ({ documents: [] }));

    for (const doc of result.documents) {
      // Eliminar branch_managers del jefe
      const bms = await databases
        .listDocuments(DB_ID, "branch_managers", [Query.equal("user_id", doc.$id)])
        .catch(() => ({ documents: [] }));
      for (const bm of bms.documents) {
        await databases.deleteDocument(DB_ID, "branch_managers", bm.$id).catch(() => {});
      }
      await databases.deleteDocument(DB_ID, "users", doc.$id).catch(() => {});
      await users.delete(doc.$id).catch(() => {});
    }
  });

  test("admin crea jefe con 2 sucursales y queda en la lista", async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL("/admin");

    await page.goto("/admin/usuarios/nuevo");

    await page.getByPlaceholder("Juan Pérez").fill(JEFE_NOMBRE);
    await page.getByPlaceholder("jefe@empresa.cl").fill(JEFE_EMAIL);
    await page.getByPlaceholder(/mínimo 8 caracteres/i).fill(JEFE_PASSWORD);

    // Seleccionar branches A y B (no C)
    await page
      .locator("label")
      .filter({ hasText: "Sucursal E2E Alpha" })
      .locator('input[type="checkbox"]')
      .check();
    await page
      .locator("label")
      .filter({ hasText: "Sucursal E2E Beta" })
      .locator('input[type="checkbox"]')
      .check();

    await page.getByRole("button", { name: /crear jefe/i }).click();
    await page.waitForURL("/admin/usuarios");

    await expect(page.getByText(JEFE_NOMBRE)).toBeVisible();
  });

  test("jefe ve solo sus 2 sucursales asignadas", async ({ page }) => {
    await loginViaUI(page, JEFE_EMAIL, JEFE_PASSWORD);
    await page.waitForURL("/jefe");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Sucursal E2E Alpha")).toBeVisible();
    await expect(page.getByText("Sucursal E2E Beta")).toBeVisible();
    await expect(page.getByText("Sucursal E2E Gamma")).not.toBeVisible();
  });

  test("jefe recibe 403 al intentar URL de sucursal no asignada", async ({ page }) => {
    await loginViaUI(page, JEFE_EMAIL, JEFE_PASSWORD);
    await page.waitForURL("/jefe");
    await page.waitForLoadState("networkidle");

    await page.goto(`/jefe/sucursales/${branchC.$id}`);
    await page.waitForURL("/jefe/403");

    await expect(page.getByText("403")).toBeVisible();
    await expect(page.getByText(/no tenés permiso/i)).toBeVisible();
  });
});
