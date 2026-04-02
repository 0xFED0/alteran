import { labelFor } from "@libs/labels";

export function main(): void {
  console.log(`admin-console imported ${labelFor("admin-console")}`);
}

if (import.meta.main) {
  main();
}
