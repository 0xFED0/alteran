export function normalizeJobName(value: string | undefined): string {
  return value?.trim() || "nightly-sync";
}
