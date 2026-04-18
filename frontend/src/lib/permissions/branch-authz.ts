export function isBranchAuthorized(
  authorizedBranchIds: string[],
  branchId: string
): boolean {
  return authorizedBranchIds.includes(branchId);
}
