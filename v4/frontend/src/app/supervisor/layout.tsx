import { getSession } from "@/lib/auth/session";
import SupervisorShell from "./SupervisorShell";
import AdminShell from "@/app/admin/AdminShell";

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role === "admin") {
    return <AdminShell userEmail={session.email ?? ""}>{children}</AdminShell>;
  }
  return <SupervisorShell userName={session?.nombre ?? session?.email ?? ""}>{children}</SupervisorShell>;
}
