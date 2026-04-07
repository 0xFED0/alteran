export function main(args: string[]): void {
  console.log(`child stdout ${args.join(",") || "no-args"}`);
  console.error("child stderr marker");
}

if (import.meta.main) {
  main(Deno.args);
}
