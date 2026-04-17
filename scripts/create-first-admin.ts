import "dotenv/config";
import { Client, Databases, Users, ID, Permission, Role, AppwriteException, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const users = new Users(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

// Lee valores del .env o de los args CLI: create-first-admin.ts [email] [password] [nombre]
const [, , argEmail, argPassword, ...argNombreParts] = process.argv;
const email = argEmail ?? process.env.FIRST_ADMIN_EMAIL;
const password = argPassword ?? process.env.FIRST_ADMIN_PASSWORD;
const nombre = argNombreParts.length > 0
  ? argNombreParts.join(" ")
  : process.env.FIRST_ADMIN_NAME;

async function main() {
  if (!email || !password || !nombre) {
    console.error(
      "ERROR: faltan datos.\n" +
      "Usa variables de entorno (FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD, FIRST_ADMIN_NAME)\n" +
      "o pásalos por CLI: npx tsx scripts/create-first-admin.ts email password nombre"
    );
    process.exit(1);
  }

  console.log("=== create-first-admin ===");
  console.log(`email  : ${email}`);
  console.log(`nombre : ${nombre}`);
  console.log();

  // 1. Crear usuario en Auth
  let userId: string;
  try {
    const authUser = await users.create(ID.unique(), email, undefined, password, nombre);
    userId = authUser.$id;
    console.log(`✓ usuario Auth creado — id: ${userId}`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) {
      // Ya existe — buscar por email para obtener el id
      const list = await users.list([Query.equal("email", email)]);
      const existing = list.users.find((u) => u.email === email);
      if (!existing) {
        console.error("ERROR: el usuario ya existe pero no se pudo recuperar.");
        process.exit(1);
      }
      userId = existing.$id;
      console.log(`↷ usuario Auth ya existía — id: ${userId}`);
    } else {
      throw e;
    }
  }

  // 2. Asignar label "admin"
  await users.updateLabels(userId, ["admin"]);
  console.log(`✓ label 'admin' asignado`);

  // 3. Crear documento en colección users
  const docData = {
    email,
    nombre_completo: nombre,
    rol: "admin",
    activo: true,
  };
  // Permisos a nivel de documento: el propio usuario puede leer su doc
  const docPerms = [
    Permission.read(Role.user(userId)),
    Permission.read(Role.label("admin")),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ];
  try {
    await db.createDocument(DB, "users", userId, docData, docPerms);
    console.log(`✓ documento en colección 'users' creado`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) {
      console.log(`↷ documento en colección 'users' ya existía, skip`);
    } else {
      throw e;
    }
  }

  console.log("\n=== admin listo ===");
  console.log(`  id    : ${userId}`);
  console.log(`  email : ${email}`);
  console.log(`  label : admin`);
  console.log("\nPodés verificar el login en la consola Appwrite.");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
