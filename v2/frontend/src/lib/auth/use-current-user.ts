"use client";

import { useState, useEffect } from "react";
import { Query } from "appwrite";
import { account, databases, syncAppwriteSession } from "@/lib/auth/appwrite-client";
import type { User, BranchManager } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isJefe, setIsJefe] = useState(false);
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
        setIsAdmin(admin);
        setIsJefe(jefe);

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
        if (!cancelled) setError("Sesión no válida");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { user, isAdmin, isJefe, authorizedBranchIds, loading, error };
}
