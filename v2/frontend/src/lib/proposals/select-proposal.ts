import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

export async function selectProposalForMonth(
  branchId: string,
  year: number,
  month: number,
  proposalId: string,
  userId: string
): Promise<void> {
  const result = await databases.listDocuments(DB, "proposals", [
    Query.equal("branch_id", branchId),
    Query.equal("anio", year),
    Query.equal("mes", month),
    Query.notEqual("estado", "descartada"),
    Query.limit(20),
  ]);

  await Promise.all(
    result.documents.map((doc) => {
      if (doc.$id === proposalId) {
        return databases.updateDocument(DB, "proposals", doc.$id, {
          estado: "seleccionada",
          seleccionada_por: userId,
        });
      }

      if (doc.estado === "seleccionada") {
        return databases.updateDocument(DB, "proposals", doc.$id, {
          estado: "generada",
        });
      }

      return Promise.resolve(doc);
    })
  );
}
