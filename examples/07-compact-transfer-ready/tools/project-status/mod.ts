import { describePersistence } from "@libs/persistence";

export function main(): void {
  console.log(`project-status ${describePersistence()}`);
}
