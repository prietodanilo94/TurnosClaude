export function normalizeSupervisorName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function supervisorLookupKey(raw: string): string {
  return normalizeSupervisorName(raw).toLocaleLowerCase("es-CL");
}
