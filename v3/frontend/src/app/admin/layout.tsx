import Link from "next/link";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
    >
      {children}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-52 shrink-0 bg-gray-900 text-white">
        <div className="border-b border-gray-700 px-4 py-5">
          <p className="text-sm font-semibold text-white">Shift Optimizer v3</p>
          <p className="mt-1 text-xs text-gray-400">Optimizer Lab</p>
        </div>

        <nav className="space-y-1 px-2 py-4">
          <NavLink href="/admin/optimizer-lab">Optimizer Lab</NavLink>
        </nav>
      </aside>

      <main className="min-h-screen flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
