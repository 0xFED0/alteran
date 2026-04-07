import { labelFor } from "@libs/labels";

export function main(): void {
  console.log(`catalog ready ${labelFor("catalog")}`);
}

if (import.meta.main) {
  main();
}
