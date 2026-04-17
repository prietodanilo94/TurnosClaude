import { Client, Users, Databases, ID, Permission, Role } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;

function makeClient() {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
}

export async function POST(req: NextRequest) {
  const { email, password, nombre_completo, rut, branch_ids } = await req.json();

  const client = makeClient();
  const usersApi = new Users(client);
  const db = new Databases(client);

  // 1. Crear cuenta en Appwrite Auth
  let userId: string;
  try {
    const authUser = await usersApi.create(
      ID.unique(),
      email,
      undefined,
      password,
      nombre_completo
    );
    userId = authUser.$id;
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Error creando cuenta de usuario" },
      { status: 400 }
    );
  }

  // 2. Crear documento en colección users
  try {
    await db.createDocument(DB, "users", userId, {
      email,
      nombre_completo,
      rut: rut || null,
      rol: "jefe_sucursal",
      activo: true,
    }, [Permission.read(Role.user(userId))]);
  } catch (e: any) {
    await usersApi.delete(userId).catch(() => {});
    return NextResponse.json(
      { error: e.message ?? "Error creando documento de usuario" },
      { status: 500 }
    );
  }

  // 3. Crear branch_managers
  const now = new Date().toISOString();
  try {
    await Promise.all(
      (branch_ids as string[]).map((branchId) =>
        db.createDocument(DB, "branch_managers", ID.unique(), {
          user_id: userId,
          branch_id: branchId,
          asignado_desde: now,
          asignado_hasta: null,
        })
      )
    );
  } catch (e: any) {
    await db.deleteDocument(DB, "users", userId).catch(() => {});
    await usersApi.delete(userId).catch(() => {});
    return NextResponse.json(
      { error: e.message ?? "Error asignando sucursales" },
      { status: 500 }
    );
  }

  // 4. Agregar label jefesucursal
  try {
    await usersApi.updateLabels(userId, ["jefesucursal"]);
  } catch (e: any) {
    await db.deleteDocument(DB, "users", userId).catch(() => {});
    await usersApi.delete(userId).catch(() => {});
    return NextResponse.json(
      { error: e.message ?? "Error asignando rol" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: userId }, { status: 201 });
}
