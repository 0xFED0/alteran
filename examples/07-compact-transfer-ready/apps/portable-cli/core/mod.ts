import { describePersistence } from "@libs/persistence";

export function main(): void {
  console.log(`portable-cli ${describePersistence()}`);
}

if (import.meta.main) {
  main();
}
