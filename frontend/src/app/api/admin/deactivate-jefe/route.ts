import { Client, Users, Databases, Query } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;

export async function POST(req: NextRequest) {
  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const usersApi = new Users(client);
  const db = new Databases(client);
  const now = new Date().toISOString();

  // 1. Marcar activo=false en colección users
  try {
    await db.updateDocument(DB, "users", user_id, { activo: false });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Error actualizando estado del usuario" },
      { status: 500 }
    );
  }

  // 2. Deshabilitar cuenta en Appwrite Auth
  try {
    await usersApi.updateStatus(user_id, false);
  } catch (e: any) {
    // Revertir paso 1 best-effort
    await db.updateDocument(DB, "users", user_id, { activo: true }).catch(() => {});
    return NextResponse.json(
      { error: e.message ?? "Error deshabilitando cuenta" },
      { status: 500 }
    );
  }

  // 3. Cerrar todas las branch_managers vigentes
  try {
    const bms = await db.listDocuments(DB, "branch_managers", [
      Query.equal("user_id", user_id),
      Query.isNull("asignado_hasta"),
      Query.limit(100),
    ]);
    await Promise.all(
      bms.documents.map((bm) =>
        db.updateDocument(DB, "branch_managers", bm.$id, { asignado_hasta: now })
      )
    );
  } catch {
    // No-fatal: el usuario ya está desactivado, el historial se puede corregir manualmente
  }

  return NextResponse.json({ ok: true });
}
