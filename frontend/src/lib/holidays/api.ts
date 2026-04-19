import { ID, Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { Holiday } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main";

export async function listHolidays(opts?: { year?: number; month?: number }): Promise<Holiday[]> {
  const filters = [];
  if (opts?.year !== undefined) filters.push(Query.equal("anio", opts.year));
  filters.push(Query.orderAsc("fecha"), Query.limit(100));

  const result = await databases.listDocuments(DB, "holidays", filters);
  const all = result.documents as unknown as Holiday[];

  if (opts?.month !== undefined) {
    const pad = String(opts.month).padStart(2, "0");
    return all.filter((h) => h.fecha.slice(5, 7) === pad);
  }

  return all;
}

export async function createHoliday(data: {
  fecha: string;
  nombre: string;
}): Promise<Holiday> {
  const anio = parseInt(data.fecha.slice(0, 4), 10);
  const doc = await databases.createDocument(DB, "holidays", ID.unique(), {
    fecha: data.fecha,
    nombre: data.nombre,
    tipo: "irrenunciable",
    anio,
  });
  return doc as unknown as Holiday;
}

export async function deleteHoliday(id: string): Promise<void> {
  await databases.deleteDocument(DB, "holidays", id);
}
