import { labelFor } from "@libs/labels";

export function main(args: string[]): void {
  const subject = args[0] ?? "audit-report";
  console.log(`audit imported ${labelFor(subject)}`);
}
