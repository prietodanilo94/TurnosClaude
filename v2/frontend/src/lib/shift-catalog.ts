import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { ShiftV2 } from "@/types/models";

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";
const COLL_ID = "shift_catalog_v2";

/**
 * Recupera todos los turnos aplicables a un grupo de rotación específico.
 * @param rotationGroup El nombre del grupo. Ej: "V_SA", "V_M7"
 */
export async function getShiftsForGroup(rotationGroup: string): Promise<ShiftV2[]> {
  try {
    const response = await databases.listDocuments(DB_ID, COLL_ID, [
      Query.equal("rotation_group", rotationGroup),
    ]);

    // Parseamos internamente el backend strings a objetos ShiftV2
    return response.documents.map((doc: any): ShiftV2 => {
      let parsedHorario = {};
      try {
        parsedHorario = typeof doc.horario_por_dia === "string" 
          ? JSON.parse(doc.horario_por_dia) 
          : doc.horario_por_dia;
      } catch (e) {
        console.error(`Error parseando horario para el shift ${doc.$id}`, e);
      }

      return {
        $id: doc.$id,
        nombre_display: doc.nombre_display,
        rotation_group: doc.rotation_group,
        nombre_turno: doc.nombre_turno as any,
        horario_por_dia: parsedHorario,
        descuenta_colacion: doc.descuenta_colacion,
        dias_aplicables: doc.dias_aplicables || [],
      };
    });
  } catch (error) {
    console.error(`Error obteniendo shifts para el grupo ${rotationGroup}:`, error);
    return [];
  }
}
