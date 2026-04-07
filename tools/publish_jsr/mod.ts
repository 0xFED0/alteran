import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exists, listDirectSubdirectories } from "../../src/alteran/fs.ts";
import { ALTERAN_VERSION } from "../../src/alteran/version.ts";
import {
  getVersionedJsrDistDir,
  main as prepareJsrMain,
} from "../prepare_jsr/mod.ts";

interface PublishJsrOptions {
  version: string;
  token?: string;
  helpRequested?: boolean;
}

export function renderPublishJsrHelp(): string {
  return "Usage:\n  alteran tool run publish_jsr [--version <current|latest|x.y.z>] [--token <jsr-token>]\n\nOptions:\n  --version current   Prepare and publish the current repository version (default)\n  --version latest    Publish the latest already-prepared dist/jsr/<version> directory\n  --version x.y.z     Publish a specific already-prepared dist/jsr/<version> directory\n  --token <token>     Pass an explicit JSR token instead of interactive auth\n\nEnvironment:\n  JSR_TOKEN           Preferred publish token environment variable\n  ALTERAN_JSR_TOKEN   Backward-compatible Alteran-specific token environment variable";
}

function isVersionDirectoryName(name: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(name);
}

function compareSemverLike(left: string, right: string): number {
  const split = (value: string): [number[], string] => {
    const [core, suffix = ""] = value.split(/-(.*)/s, 2);
    return [core.split(".").map((part) => Number(part)), suffix];
  };

  const [leftCore, leftSuffix] = split(left);
  const [rightCore, rightSuffix] = split(right);

  for (let index = 0; index < Math.max(leftCore.length, rightCore.length); index++) {
    const delta = (leftCore[index] ?? 0) - (rightCore[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  if (!leftSuffix && rightSuffix) {
    return 1;
  }
  if (leftSuffix && !rightSuffix) {
    return -1;
  }
  return leftSuffix.localeCompare(rightSuffix);
}

export async function resolveLatestPreparedJsrVersion(
  repoRoot: string,
): Promise<string> {
  const distRoot = join(repoRoot, "dist", "jsr");
  const versions = (await listDirectSubdirectories(distRoot))
    .filter(isVersionDirectoryName)
    .sort(compareSemverLike);

  const latest = versions.at(-1);
  if (!latest) {
    throw new Error(
      `No prepared JSR versions found under ${distRoot}. Run prepare_jsr first.`,
    );
  }
  return latest;
}

export function parsePublishJsrArgs(args: string[]): PublishJsrOptions {
  let version = "current";
  let token = Deno.env.get("JSR_TOKEN") ?? Deno.env.get("ALTERAN_JSR_TOKEN") ??
    undefined;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      return { version, token, helpRequested: true };
    }
    if (arg === "--version") {
      version = args[index + 1] ?? "";
      index++;
      continue;
    }
    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      continue;
    }
    if (arg === "--token") {
      token = args[index + 1] ?? "";
      index++;
      continue;
    }
    if (arg.startsWith("--token=")) {
      token = arg.slice("--token=".length);
      continue;
    }
    throw new Error(`Unsupported publish_jsr argument: ${arg}`);
  }

  if (!version) {
    throw new Error("publish_jsr requires a non-empty --version value");
  }
  if (token !== undefined && token.length === 0) {
    throw new Error("publish_jsr requires a non-empty --token value");
  }

  return { version, token };
}

export async function resolvePublishVersion(
  repoRoot: string,
  requestedVersion: string,
): Promise<string> {
  if (requestedVersion === "current") {
    await prepareJsrMain([]);
    return ALTERAN_VERSION;
  }
  if (requestedVersion === "latest") {
    return await resolveLatestPreparedJsrVersion(repoRoot);
  }
  return requestedVersion;
}

export async function main(args: string[]): Promise<void> {
  const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const options = parsePublishJsrArgs(args);
  if (options.helpRequested) {
    console.log(renderPublishJsrHelp());
    return;
  }
  const version = await resolvePublishVersion(repoRoot, options.version);
  const distDir = getVersionedJsrDistDir(repoRoot, version);

  if (!(await exists(join(distDir, "jsr.json")))) {
    throw new Error(
      `Prepared JSR package does not exist for version ${version}: ${distDir}. Run prepare_jsr first or use --version current.`,
    );
  }

  const publishArgs = ["publish", "--config", "jsr.json"];
  if (options.token) {
    publishArgs.push("--token", options.token);
  }

  const output = await new Deno.Command(Deno.execPath(), {
    args: publishArgs,
    cwd: distDir,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).output();

  if (!output.success) {
    throw new Error(`deno publish failed with code ${output.code}`);
  }
}
