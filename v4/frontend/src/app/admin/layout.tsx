import { getSession } from "@/lib/auth/session";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const userName = session?.email ?? "";

  return <AdminShell userEmail={userName}>{children}</AdminShell>;
}
