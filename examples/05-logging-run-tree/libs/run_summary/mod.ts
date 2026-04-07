export function summarizeArgs(args: string[]): string {
  return args.length === 0 ? "no-args" : args.join(",");
}
