"use client";

import { useEffect, useState } from "react";
import { Query } from "appwrite";
import { account, databases, syncAppwriteSession } from "@/lib/auth/appwrite-client";
import type { BranchManager, User } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const PUBLIC_USER_ID = "public-v2";

const PUBLIC_USER: User = {
  $id: PUBLIC_USER_ID,
  email: "public@shift-optimizer.local",
  nombre_completo: "Modo publico",
  rol: "admin",
  activo: true,
};

export interface CurrentUser {
  user: User | null;
  isAdmin: boolean;
  isJefe: boolean;
  authorizedBranchIds: string[];
  loading: boolean;
  error: string | null;
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isJefe, setIsJefe] = useState(true);
  const [authorizedBranchIds, setAuthorizedBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        syncAppwriteSession();
        const authUser = await account.get();
        if (cancelled) return;

        const labels = authUser.labels ?? [];
        const admin = labels.includes("admin");
        const jefe = labels.includes("jefesucursal");

        const userDoc = (await databases.getDocument(
          DB_ID,
          "users",
          authUser.$id
        )) as unknown as User;
        if (cancelled) return;

        setUser(userDoc);
        setIsAdmin(true);
        setIsJefe(true);

        if (jefe && !admin) {
          const result = await databases.listDocuments(DB_ID, "branch_managers", [
            Query.equal("user_id", authUser.$id),
            Query.isNull("asignado_hasta"),
            Query.limit(100),
          ]);
          if (cancelled) return;
          setAuthorizedBranchIds(
            (result.documents as unknown as BranchManager[]).map((bm) => bm.branch_id)
          );
        }
      } catch {
        if (cancelled) return;
        setUser(PUBLIC_USER);
        setIsAdmin(true);
        setIsJefe(true);
        setAuthorizedBranchIds([]);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isAdmin, isJefe, authorizedBranchIds, loading, error };
}
