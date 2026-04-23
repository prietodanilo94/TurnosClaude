import { BranchDetailClient } from "./BranchDetailClient";

export default function BranchDetailPage({
  params,
}: {
  params: { branchId: string };
}) {
  return <BranchDetailClient branchId={params.branchId} />;
}
