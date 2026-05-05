import { getSession } from "@/lib/auth/session";
import SupervisorShell from "./SupervisorShell";

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return <SupervisorShell userName={session?.nombre ?? session?.email ?? ""}>{children}</SupervisorShell>;
}
