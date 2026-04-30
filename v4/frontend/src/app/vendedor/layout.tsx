import { getSession } from "@/lib/auth/session";
import VendedorShell from "./VendedorShell";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return <VendedorShell nombre={session?.nombre ?? session?.email ?? ""}>{children}</VendedorShell>;
}
