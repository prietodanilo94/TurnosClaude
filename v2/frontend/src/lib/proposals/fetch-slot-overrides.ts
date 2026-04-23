import { Query } from "appwrite";
import { databases } from "@/lib/auth/appwrite-client";
import type { SlotOverride } from "@/types/models";

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "main-v2";

export async function fetchSlotOverridesMap(
  proposalIds: string[]
): Promise<Record<string, SlotOverride[]>> {
  if (proposalIds.length === 0) return {};

  try {
    const result = await databases.listDocuments(DB, "slot_overrides", [
      Query.equal("proposal_id", proposalIds),
      Query.limit(500),
    ]);

    const grouped: Record<string, SlotOverride[]> = {};
    for (const doc of result.documents) {
      const override = doc as unknown as SlotOverride;
      if (!grouped[override.proposal_id]) grouped[override.proposal_id] = [];
      grouped[override.proposal_id].push(override);
    }
    return grouped;
  } catch {
    // The collection may not exist yet in older environments.
    return {};
  }
}
