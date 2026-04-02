export function renderRows(rows: Array<[string, string]>): string {
  return rows.map(([left, right]) => `${left}: ${right}`).join("\n");
}
