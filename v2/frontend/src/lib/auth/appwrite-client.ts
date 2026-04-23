import { Client, Account, Databases } from "appwrite";
import { getAppwriteSessionCookie } from "@/lib/auth/session";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://appwrite.invalid/v1";
const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "build-placeholder";

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

let syncedSession: string | null = null;

export function syncAppwriteSession() {
  if (typeof window === "undefined") return;

  const session = getAppwriteSessionCookie();
  if (session === syncedSession) return;

  client.setSession(session ?? "");
  syncedSession = session;
}

syncAppwriteSession();

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
