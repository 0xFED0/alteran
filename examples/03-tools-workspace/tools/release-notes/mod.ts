import { renderRows } from "@libs/table";

export function main(args: string[]): void {
  const [version = "0.0.0", ...items] = args;
  console.log(`release ${version}`);
  console.log(
    renderRows(
      (items.length === 0 ? ["added-managed-tools"] : items).map((
        item,
        index,
      ) => [
        `item_${index + 1}`,
        item,
      ]),
    ),
  );
}
