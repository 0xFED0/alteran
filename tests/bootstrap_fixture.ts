import { basename, extname, join, resolve } from "node:path";

import { copyDirectory, ensureDir, removeIfExists } from "../src/alteran/fs.ts";
import {
  TEST_TRACE_CATEGORY,
  traceTestStep,
  traceTestWarning,
} from "./test_trace.ts";

function contentTypeForPath(path: string): string {
  switch (extname(path)) {
    case ".ts":
      return "application/typescript; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".zip":
      return "application/zip";
    case ".md":
      return "text/markdown; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function createZipArchive(
  sourceDir: string,
  archivePath: string,
): Promise<void> {
  const output = Deno.build.os === "windows"
    ? await new Deno.Command("powershell", {
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Get-ChildItem -Force | Compress-Archive -Force -DestinationPath '${
          archivePath.replaceAll("'", "''")
        }'`,
      ],
      cwd: sourceDir,
      stdout: "piped",
      stderr: "piped",
    }).output()
    : await new Deno.Command("zip", {
      args: ["-qr", archivePath, "."],
      cwd: sourceDir,
      stdout: "piped",
      stderr: "piped",
    }).output();

  if (!output.success) {
    throw new Error(
      `Failed to create bootstrap archive. stdout=${
        new TextDecoder().decode(output.stdout)
      } stderr=${new TextDecoder().decode(output.stderr)}`,
    );
  }
}

export async function prepareBootstrapFixture(
  repoDir: string,
  options: { tempDir?: string } = {},
): Promise<{
  archivePath: string;
  cleanup: () => Promise<void>;
  runSourceUrlPath: string;
  servedDir: string;
}> {
  if (options.tempDir) {
    await ensureDir(options.tempDir);
  }
  const tempRoot = await Deno.makeTempDir({
    dir: options.tempDir,
    prefix: "alteran-bootstrap-fixture-",
  });
  const servedDir = join(tempRoot, "served");
  const bundleDir = join(servedDir, "bundle");
  const archivePath = join(servedDir, "alteran.zip");

  await traceTestStep(
    [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
    "preparing bootstrap fixture",
    {
      repo_dir: repoDir,
      temp_root: tempRoot,
      served_dir: servedDir,
    },
  );

  await copyDirectory(repoDir, bundleDir, {
    filter: (absolutePath) => {
      const relativePath = absolutePath.slice(repoDir.length + 1).replaceAll(
        "\\",
        "/",
      );
      return !relativePath.startsWith(".git/") &&
        !relativePath.startsWith(".runtime/") &&
        !relativePath.startsWith("dist/");
    },
  });
  await removeIfExists(join(bundleDir, ".runtime"));
  await createZipArchive(bundleDir, archivePath);
  await traceTestStep(
    [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
    "bootstrap fixture ready",
    {
      run_source_url_path: "/bundle/alteran.ts",
      archive_path: archivePath,
    },
  );

  return {
    archivePath,
    cleanup: async () => {
      await traceTestStep(
        [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
        "cleaning bootstrap fixture",
        {
          temp_root: tempRoot,
        },
      );
      await removeIfExists(tempRoot);
    },
    runSourceUrlPath: "/bundle/alteran.ts",
    servedDir,
  };
}

export async function startStaticFileServer(rootDir: string): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  await traceTestStep(
    [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
    "starting static file server",
    {
      root_dir: rootDir,
    },
  );
  let resolveBaseUrl: ((value: string) => void) | undefined;
  const baseUrlPromise = new Promise<string>((resolve) => {
    resolveBaseUrl = resolve;
  });

  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen({ hostname, port }) {
      resolveBaseUrl?.(`http://${hostname}:${port}`);
    },
  }, async (request: Request) => {
    const url = new URL(request.url);
    const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(rootDir, `.${relativePath}`);

    if (!filePath.startsWith(resolve(rootDir))) {
      return new Response("forbidden", { status: 403 });
    }

    try {
      const data = await Deno.readFile(filePath);
      return new Response(data, {
        headers: {
          "content-type": contentTypeForPath(filePath),
          "x-served-file": basename(filePath),
        },
      });
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        void traceTestWarning(
          [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
          "static file request missed",
          {
            root_dir: rootDir,
            path: relativePath,
          },
        );
        return new Response("not found", { status: 404 });
      }
      return new Response(String(error), { status: 500 });
    }
  });

  const baseUrl = await baseUrlPromise;
  await traceTestStep(
    [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
    "static file server ready",
    {
      root_dir: rootDir,
      base_url: baseUrl,
    },
  );
  return {
    baseUrl,
    close: async () => {
      await traceTestStep(
        [...TEST_TRACE_CATEGORY.e2eHarness, "bootstrap_fixture"],
        "stopping static file server",
        {
          base_url: baseUrl,
        },
      );
      await server.shutdown();
    },
  };
}
