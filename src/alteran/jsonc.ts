import {
  applyEdits,
  modify,
  parse,
  type ParseError,
} from "npm:jsonc-parser@3.3.1";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyValueSync(
  text: string,
  currentValue: unknown,
  nextValue: unknown,
  path: (string | number)[],
): string {
  if (sameValue(currentValue, nextValue)) {
    return text;
  }

  if (isPlainObject(currentValue) && isPlainObject(nextValue)) {
    for (const key of Object.keys(currentValue)) {
      if (!(key in nextValue)) {
        const edits = modify(text, [...path, key], undefined, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
          getInsertionIndex: () => 0,
        });
        text = applyEdits(text, edits);
      }
    }

    for (const key of Object.keys(nextValue)) {
      text = applyValueSync(text, currentValue[key], nextValue[key], [
        ...path,
        key,
      ]);
    }

    return text;
  }

  const edits = modify(text, path, nextValue, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
    getInsertionIndex: () => 0,
  });
  return applyEdits(text, edits);
}

export function parseJsonc<T>(text: string, fallback: T): T {
  const errors: ParseError[] = [];
  const parsed = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0 || parsed === undefined) {
    return fallback;
  }
  return parsed as T;
}

export async function updateJsoncFile<T>(
  path: string,
  fallback: T,
  updater: (current: T) => T,
): Promise<T> {
  let sourceText: string;

  try {
    sourceText = await Deno.readTextFile(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    const initial = updater(structuredClone(fallback));
    sourceText = `${JSON.stringify(initial, null, 2)}\n`;
    await Deno.writeTextFile(path, sourceText);
    return initial;
  }

  const current = parseJsonc<T>(sourceText, fallback);
  const next = updater(structuredClone(current));
  const updated = applyValueSync(sourceText, current, next, []);
  const normalized = updated.endsWith("\n") ? updated : `${updated}\n`;

  if (normalized !== sourceText) {
    await Deno.writeTextFile(path, normalized);
  }

  return next;
}
