import { getLogger, type MockLogger } from "./logtape_cfg_mock.ts";

export function getChildWith(
  loggerOrCategory: MockLogger | string | string[],
  category: string | string[],
  context: Record<string, unknown> = {},
): MockLogger {
  const base =
    typeof loggerOrCategory === "object" && "with" in loggerOrCategory
      ? loggerOrCategory
      : getLogger(loggerOrCategory);

  const nextCategory = Array.isArray(category) ? category : [category];
  return getLogger([...base.category, ...nextCategory]).with({
    ...base.context,
    ...context,
  });
}

export async function withCategoryAndContext<T>(
  category: string | string[],
  context: Record<string, unknown>,
  fn: (logger: MockLogger) => Promise<T> | T,
): Promise<T> {
  const logger = getLogger(category).with(context);
  return await fn(logger);
}
