import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir } from "../src/alteran/fs.ts";
import { prepareBootstrapFixture } from "./bootstrap_fixture.ts";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

const ALTERAN_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCKER_TMP_ROOT = resolve(ALTERAN_REPO_DIR, ".runtime", "docker-test-fixtures");

async function dockerAvailable(): Promise<boolean> {
  try {
    const output = await new Deno.Command("docker", {
      args: ["info"],
      stdout: "null",
      stderr: "null",
    }).output();
    return output.success;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

const DOCKER_AVAILABLE = await dockerAvailable();

function buildBootstrapCommand(baseImage: string): string {
  if (baseImage.startsWith("denoland/deno:")) {
    return [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3 unzip",
      "update-ca-certificates",
    ].join(" && ");
  }

  if (baseImage.startsWith("ubuntu:")) {
    return [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3 unzip",
      "update-ca-certificates",
    ].join(" && ");
  }

  if (baseImage.startsWith("debian:")) {
    return [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3 unzip",
      "update-ca-certificates",
    ].join(" && ");
  }

  return [
    "apk add --no-cache ca-certificates curl python3 unzip gcompat",
    "update-ca-certificates",
  ].join(" && ");
}

function buildGlobalDenoCommand(baseImage: string): string {
  if (baseImage.startsWith("denoland/deno:")) {
    return "";
  }

  if (baseImage.startsWith("alpine:")) {
    return 'export DENO_INSTALL=/usr/local && curl -fsSL https://deno.land/install.sh | sh -s -- -q && export PATH="/usr/local/bin:$PATH"';
  }

  return 'export DENO_INSTALL=/usr/local && curl -fsSL https://deno.land/install.sh | sh -s -- -q && export PATH="/usr/local/bin:$PATH"';
}

function buildDockerScript(baseImage: string, withGlobalDeno: boolean): string {
  const setupSteps = [
    "set -eu",
    buildBootstrapCommand(baseImage),
    withGlobalDeno
      ? buildGlobalDenoCommand(baseImage)
      : "",
    "unset ALTERAN_SRC ALTERAN_HOME || true",
    "cat >/tmp/bootstrap_server.py <<'PY'\n"
      + "from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler\n"
      + "import functools\n"
      + "import mimetypes\n"
      + "mimetypes.add_type('application/typescript; charset=utf-8', '.ts')\n"
      + "mimetypes.add_type('application/javascript; charset=utf-8', '.js')\n"
      + "mimetypes.add_type('application/json; charset=utf-8', '.json')\n"
      + "handler = functools.partial(SimpleHTTPRequestHandler, directory='/served')\n"
      + "server = ThreadingHTTPServer(('127.0.0.1', 18080), handler)\n"
      + "server.serve_forever()\n"
      + "PY",
    'python3 /tmp/bootstrap_server.py >/tmp/bootstrap-server.log 2>&1 & SERVER_PID=$!',
    'cleanup() { kill "$SERVER_PID" >/dev/null 2>&1 || true; }',
    'trap cleanup EXIT',
    'server_ready() { curl -fsS http://127.0.0.1:18080/bundle/alteran.ts >/dev/null; }',
    'attempt=0; until server_ready; do attempt=$((attempt + 1)); if [ "$attempt" -ge 50 ]; then cat /tmp/bootstrap-server.log >&2 || true; echo "Local bootstrap fixture server did not become ready" >&2; exit 1; fi; sleep 0.1; done',
    'export REMOTE_RUN_SOURCE=http://127.0.0.1:18080/bundle/alteran.ts',
    'export REMOTE_ARCHIVE_SOURCE=http://127.0.0.1:18080/alteran.zip',
    'ensure_deno_in_path() { if command -v deno >/dev/null 2>&1; then return 0; fi; local_deno=$(find /target -type f -path "*/.runtime/deno/*/bin/deno" | head -n 1 || true); [ -n "$local_deno" ] || { echo "No deno executable available" >&2; exit 1; }; export PATH="$(dirname "$local_deno"):$PATH"; }',
    'assert_active() { target_dir=$1; ( cd "$target_dir" && . ./activate >/dev/null && [ "$ALTERAN_HOME" = "$target_dir/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && command -v deno >/dev/null && deno --version >/dev/null && alteran help >/dev/null ); }',
    "mkdir -p /work /target",
    "mkdir -p /target/copied",
    "cp /source/setup /source/setup.bat /target/copied/",
    "chmod +x /target/copied/setup",
    '( cd /target/copied && ALTERAN_RUN_SOURCES="$REMOTE_RUN_SOURCE" ALTERAN_ARCHIVE_SOURCES="$REMOTE_ARCHIVE_SOURCE" ./setup >/dev/null )',
    "assert_active /target/copied",
    "mkdir -p /target/copied-archive",
    "cp /source/setup /source/setup.bat /target/copied-archive/",
    "chmod +x /target/copied-archive/setup",
    '( cd /target/copied-archive && ALTERAN_RUN_SOURCES="" ALTERAN_ARCHIVE_SOURCES="$REMOTE_ARCHIVE_SOURCE" ./setup >/dev/null )',
    "assert_active /target/copied-archive",
    "ensure_deno_in_path",
    "sh /source/setup /target/explicit >/dev/null",
    "assert_active /target/explicit",
    "ensure_deno_in_path",
    "cp -R /source/. /work/repo",
    "chmod +x /work/repo/setup",
    '( cd /work/repo && ./setup >/dev/null && . ./activate >/dev/null && alteran setup /target/repo-setup >/dev/null )',
    "assert_active /target/repo-setup",
    "ensure_deno_in_path",
    "deno run -A /source/alteran.ts setup /target/direct-setup >/dev/null",
    "assert_active /target/direct-setup",
    '( eval "$(deno run -A /source/alteran.ts shellenv /target/direct-setup)" && [ "$ALTERAN_HOME" = "/target/direct-setup/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && [ ! -d "$ALTERAN_HOME/env" ] && alteran help >/dev/null )',
  ].filter(Boolean);

  return setupSteps.join("\n");
}

async function runDockerMatrix(
  baseImage: string,
  withGlobalDeno: boolean,
): Promise<void> {
  await ensureDir(DOCKER_TMP_ROOT);
  const fixture = await prepareBootstrapFixture(ALTERAN_REPO_DIR, {
    tempDir: DOCKER_TMP_ROOT,
  });
  try {
    const output = await new Deno.Command("docker", {
      args: [
        "run",
        "--rm",
        "--user",
        "root",
        "-v",
        `${ALTERAN_REPO_DIR}:/source:ro`,
        "-v",
        `${fixture.servedDir}:/served:ro`,
        "-e",
        "ALTERAN_RUN_SOURCES=http://127.0.0.1:18080/bundle/alteran.ts",
        "-e",
        "ALTERAN_ARCHIVE_SOURCES=http://127.0.0.1:18080/alteran.zip",
        baseImage,
        "sh",
        "-lc",
        buildDockerScript(baseImage, withGlobalDeno),
      ],
      env: Deno.env.toObject(),
      stdout: "piped",
      stderr: "piped",
    }).output();

    if (!output.success) {
      throw new Error(
        `Docker activation matrix failed for ${baseImage} (global deno=${withGlobalDeno}). stdout=${
          decode(output.stdout)
        } stderr=${decode(output.stderr)}`,
      );
    }
  } finally {
    await fixture.cleanup();
  }
}

Deno.test({
  name: "docker e2e: official denoland image",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("denoland/deno:latest", true);
  },
});

Deno.test({
  name: "docker e2e: ubuntu base without global deno",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("ubuntu:24.04", false);
  },
});

Deno.test({
  name: "docker e2e: debian base without global deno",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("debian:bookworm-slim", false);
  },
});
