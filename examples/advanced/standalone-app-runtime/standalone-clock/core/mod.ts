export function main(args: string[]): void {
  console.log("Standalone app standalone-clock started", { args });
}

if (import.meta.main) {
  main(Deno.args);
}
