import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir, removeIfExists } from "../src/alteran/fs.ts";
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
  if (baseImage.startsWith("ubuntu:")) {
    return [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3 unzip",
      "update-ca-certificates",
    ].join(" && ");
  }

  return [
    "apk add --no-cache ca-certificates curl python3 unzip",
    "update-ca-certificates",
  ].join(" && ");
}

function buildGlobalDenoCommand(baseImage: string): string {
  if (baseImage.startsWith("alpine:")) {
    return "apk add --no-cache deno";
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
    "cp /source/activate /source/activate.bat /target/copied/",
    "chmod +x /target/copied/activate",
    '( cd /target/copied && ALTERAN_RUN_SOURCES="$REMOTE_RUN_SOURCE" ALTERAN_ARCHIVE_SOURCES="" . ./activate >/dev/null && [ "$ALTERAN_HOME" = "/target/copied/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && command -v deno >/dev/null && deno --version >/dev/null && alteran help >/dev/null )',
    "mkdir -p /target/copied-archive",
    "cp /source/activate /source/activate.bat /target/copied-archive/",
    "chmod +x /target/copied-archive/activate",
    '( cd /target/copied-archive && ALTERAN_RUN_SOURCES="" ALTERAN_ARCHIVE_SOURCES="$REMOTE_ARCHIVE_SOURCE" . ./activate >/dev/null && [ "$ALTERAN_HOME" = "/target/copied-archive/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && command -v deno >/dev/null && deno --version >/dev/null && alteran help >/dev/null )',
    "ensure_deno_in_path",
    '( . /source/activate /target/explicit >/dev/null && [ "$ALTERAN_HOME" = "/target/explicit/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && command -v deno >/dev/null && deno --version >/dev/null && alteran help >/dev/null )',
    "ensure_deno_in_path",
    "cp -R /source/. /work/repo",
    "chmod +x /work/repo/activate",
    '( cd /work/repo && . ./activate >/dev/null && alteran init /target/repo-init >/dev/null )',
    "assert_active /target/repo-init",
    "ensure_deno_in_path",
    "deno run -A /source/alteran.ts init /target/direct-init >/dev/null",
    "assert_active /target/direct-init",
    "deno run -A /source/alteran.ts ensure-env /target/direct-ensure >/dev/null",
    '( eval "$(deno run -A /source/alteran.ts shellenv /target/direct-ensure)" && [ "$ALTERAN_HOME" = "/target/direct-ensure/.runtime" ] && [ -f "$ALTERAN_HOME/alteran/mod.ts" ] && alteran help >/dev/null )',
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
  const targetRoot = await Deno.makeTempDir({
    dir: DOCKER_TMP_ROOT,
    prefix: `alteran-docker-${baseImage.replaceAll(/[^a-z0-9]+/gi, "-")}-`,
  });
  try {
    const output = await new Deno.Command("docker", {
      args: [
        "run",
        "--rm",
        "-v",
        `${ALTERAN_REPO_DIR}:/source:ro`,
        "-v",
        `${fixture.servedDir}:/served:ro`,
        "-v",
        `${targetRoot}:/target`,
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
    await removeIfExists(targetRoot);
  }
}

Deno.test({
  name: "docker e2e: ubuntu base with global deno",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("ubuntu:24.04", true);
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
  name: "docker e2e: alpine base with global deno",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("alpine:3.20", true);
  },
});

Deno.test({
  name: "docker e2e: alpine base without global deno",
  ignore: !DOCKER_AVAILABLE,
  async fn() {
    await runDockerMatrix("alpine:3.20", false);
  },
});
