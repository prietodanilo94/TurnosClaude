import { getSession } from "@/lib/auth/session";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const role = session?.role ?? "jefe";
  const userName = session?.email ?? "";

  return <AdminShell role={role} userEmail={userName}>{children}</AdminShell>;
}
