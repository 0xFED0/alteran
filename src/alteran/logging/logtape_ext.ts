import { getLogger } from "./logtape_cfg_mock.ts";

type LoggerLike = {
  with?: (context: Record<string, unknown>) => unknown;
};

type LoggerWithContext = LoggerLike & {
  category?: readonly string[];
  context?: Record<string, unknown>;
};

function isLoggerWithContext(value: unknown): value is LoggerWithContext {
  return typeof value === "object" && value !== null;
}

function normalizeCategory(
  category: string | string[],
): string | readonly string[] {
  return Array.isArray(category) ? category : [category];
}

function readLoggerCategory(value: unknown): string[] {
  if (!isLoggerWithContext(value) || !Array.isArray(value.category)) {
    return [];
  }
  return [...value.category];
}

function readLoggerContext(value: unknown): Record<string, unknown> {
  if (
    !isLoggerWithContext(value) ||
    value.context === undefined ||
    value.context === null
  ) {
    return {};
  }
  return value.context;
}

export function getChildWith(
  loggerOrCategory: LoggerWithContext | string | string[],
  category: string | string[],
  context: Record<string, unknown> = {},
): unknown {
  const baseLogger = isLoggerWithContext(loggerOrCategory) &&
      typeof loggerOrCategory.with === "function"
    ? loggerOrCategory
    : getLogger(
      normalizeCategory(
        Array.isArray(loggerOrCategory) || typeof loggerOrCategory === "string"
          ? loggerOrCategory
          : [],
      ),
    );

  const nextCategory = Array.isArray(category) ? category : [category];
  const logger = getLogger([...readLoggerCategory(baseLogger), ...nextCategory]);
  if (typeof logger.with === "function") {
    return logger.with({
      ...readLoggerContext(baseLogger),
      ...context,
    });
  }
  return logger;
}

export async function withCategoryAndContext<T>(
  category: string | string[],
  context: Record<string, unknown>,
  fn: (logger: unknown) => Promise<T> | T,
): Promise<T> {
  const logger = getLogger(normalizeCategory(category));
  const contextualLogger = typeof logger.with === "function"
    ? logger.with(context)
    : logger;
  return await fn(contextualLogger);
}
