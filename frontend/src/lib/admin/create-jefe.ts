export interface CreateJefeInput {
  email: string;
  password: string;
  nombre_completo: string;
  rut?: string;
  branch_ids: string[];
}

export async function createJefeSucursal(input: CreateJefeInput): Promise<{ id: string }> {
  const res = await fetch("/api/admin/create-jefe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error desconocido");
  return data;
}
