import { basename, join, relative } from "node:path";

import { ensureDir, toPortablePath, writeTextFileIfChanged } from "./fs.ts";

async function writeExecutableIfNeeded(
  path: string,
  content: string,
): Promise<void> {
  await writeTextFileIfChanged(path, content);
  if (Deno.build.os !== "windows") {
    await Deno.chmod(path, 0o755);
  }
}

function createStandaloneAppGitignore(): string {
  return `# --- alteran standalone app: begin ---
.DS_Store
Thumbs.db
.runtime/
app
app.bat
dist/
# --- alteran standalone app: end ---
`;
}

function appProjectReference(appDir: string, projectDir: string): string {
  const relativeProjectDir = toPortablePath(relative(appDir, projectDir));
  return relativeProjectDir.startsWith(".")
    ? relativeProjectDir
    : `./${relativeProjectDir}`;
}

function batchAppJsonIdCheck(errorMessage: string): string {
  return `findstr /r /c:"\\"id\\"[ ]*:[ ]*\\"%APP_ID%\\\"" ".\\app.json" >nul 2>nul
if errorlevel 1 (
  echo ${errorMessage} "%APP_ID%" 1>&2
  exit /b 1
)`;
}

function escapeBatchEchoContent(value: string): string {
  return value
    .replaceAll("^", "^^")
    .replaceAll("&", "^&")
    .replaceAll("|", "^|")
    .replaceAll("<", "^<")
    .replaceAll(">", "^>")
    .replaceAll(")", "^)")
    .replaceAll("%", "%%");
}

function renderBatchFileWriteBlock(path: string, content: string): string {
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  const rendered = lines.map((line) =>
    line.length === 0 ? "  echo(" : `  echo(${escapeBatchEchoContent(line)}`
  );
  return `> "${path}" (
${rendered.join("\n")}
)`;
}

function createDevAppLauncher(
  name: string,
  appDir: string,
  projectDir: string,
): string {
  const projectRef = appProjectReference(appDir, projectDir);
  return `#!/usr/bin/env sh
set -eu

SCRIPT_PATH=$0
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
APP_NAME="${name}"
APP_ID="${name.toLowerCase()}"

cd "$APP_DIR"
[ -f "./$(basename -- "$SCRIPT_PATH")" ] || { printf '%s\\n' "Unable to confirm app launcher location." >&2; exit 1; }
[ -f "./deno.json" ] || { printf '%s\\n' "Alteran app launcher requires ./deno.json" >&2; exit 1; }
[ -f "./app.json" ] || { printf '%s\\n' "Alteran app launcher requires ./app.json" >&2; exit 1; }
grep -Eq '"id"[[:space:]]*:[[:space:]]*"'$APP_ID'"' "./app.json" || {
  printf '%s\\n' "Alteran app launcher requires app.json id '$APP_ID'" >&2
  exit 1
}

UNAME_S=$(uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M=$(uname -m)

case "$UNAME_S" in
  darwin*) ALTERAN_OS="macos" ;;
  linux*) ALTERAN_OS="linux" ;;
  msys*|mingw*|cygwin*) ALTERAN_OS="windows" ;;
  *) ALTERAN_OS="$UNAME_S" ;;
esac

case "$UNAME_M" in
  x86_64|amd64) ALTERAN_ARCH="x64" ;;
  arm64|aarch64) ALTERAN_ARCH="arm64" ;;
  *) ALTERAN_ARCH="$UNAME_M" ;;
esac

PROJECT_DIR=$(CDPATH= cd -- "$APP_DIR/${projectRef}" && pwd)
PARENT_DENO="$PROJECT_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/bin/deno"
ALTERAN_ENTRY="$PROJECT_DIR/.runtime/alteran/mod.ts"

if [ ! -x "$PARENT_DENO" ] || [ ! -f "$ALTERAN_ENTRY" ]; then
  if [ -f "./setup" ]; then
    sh "./setup" >&2
  fi
fi

if [ -x "$PARENT_DENO" ] && [ -f "$ALTERAN_ENTRY" ]; then
  export ALTERAN_HOME="$PROJECT_DIR/.runtime"
  export DENO_DIR="$PROJECT_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/cache"
  exec "$PARENT_DENO" run -A "$ALTERAN_ENTRY" app run "$APP_NAME" "$@"
fi

if command -v deno >/dev/null 2>&1; then
  exec deno task --config ./deno.json app -- "$@"
fi

printf '%s\\n' "Unable to launch app ${name}. Run $PROJECT_DIR/setup first." >&2
exit 1
`;
}

function createDevAppLauncherBat(
  name: string,
  appDir: string,
  projectDir: string,
): string {
  const projectRef = appProjectReference(appDir, projectDir).replaceAll(
    "/",
    "\\",
  );
  return `@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "LAUNCHER_NAME=%~nx0"
set "APP_ID=${name.toLowerCase()}"
if not exist ".\\%LAUNCHER_NAME%" (
  echo Unable to confirm app launcher location. 1>&2
  exit /b 1
)
if not exist ".\\deno.json" (
  echo Alteran app launcher requires .\\deno.json 1>&2
  exit /b 1
)
if not exist ".\\app.json" (
  echo Alteran app launcher requires .\\app.json 1>&2
  exit /b 1
)
${batchAppJsonIdCheck("echo Alteran app launcher requires app.json id")}

set "PROJECT_DIR=%APP_DIR%${projectRef}"
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"
set "APP_NAME=${name}"
set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"
set "PARENT_DENO=%PROJECT_DIR%\\.runtime\\deno\\windows-%ALTERAN_ARCH%\\bin\\deno.exe"
set "ALTERAN_ENTRY=%PROJECT_DIR%\\.runtime\\alteran\\mod.ts"

if not exist "%PARENT_DENO%" (
  if exist ".\\setup.bat" call ".\\setup.bat"
)
if not exist "%ALTERAN_ENTRY%" (
  if exist ".\\setup.bat" call ".\\setup.bat"
)

if exist "%PARENT_DENO%" if exist "%ALTERAN_ENTRY%" (
  set "ALTERAN_HOME=%PROJECT_DIR%\\.runtime"
  set "DENO_DIR=%PROJECT_DIR%\\.runtime\\deno\\windows-%ALTERAN_ARCH%\\cache"
  "%PARENT_DENO%" run -A "%ALTERAN_ENTRY%" app run "%APP_NAME%" %*
  exit /b %ERRORLEVEL%
)

where deno >nul 2>nul
if %ERRORLEVEL%==0 (
  deno task --config ".\\deno.json" app -- %*
  exit /b %ERRORLEVEL%
)

echo Unable to launch app ${name}. Run %PROJECT_DIR%\\setup.bat first. 1>&2
exit /b 1
`;
}

function createManagedAppSetupScript(
  name: string,
  appDir: string,
  projectDir: string,
): string {
  const projectRef = appProjectReference(appDir, projectDir);
  return `#!/usr/bin/env sh
set -eu

SCRIPT_PATH=$0
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
APP_ID="${name.toLowerCase()}"
cd "$APP_DIR"

[ -f "./$(basename -- "$SCRIPT_PATH")" ] || { printf '%s\\n' "Unable to confirm app setup location." >&2; exit 1; }
[ -f "./deno.json" ] || { printf '%s\\n' "Alteran app setup requires ./deno.json" >&2; exit 1; }
[ -f "./app.json" ] || { printf '%s\\n' "Alteran app setup requires ./app.json" >&2; exit 1; }
grep -Eq '"id"[[:space:]]*:[[:space:]]*"'$APP_ID'"' "./app.json" || {
  printf '%s\\n' "Alteran app setup requires app.json id '$APP_ID'" >&2
  exit 1
}

PROJECT_DIR=$(CDPATH= cd -- "$APP_DIR/${projectRef}" && pwd)
ROOT_SETUP="$PROJECT_DIR/setup"

[ -f "$ROOT_SETUP" ] || {
  printf '%s\\n' "Alteran app setup requires $ROOT_SETUP" >&2
  exit 1
}

sh "$ROOT_SETUP" "$PROJECT_DIR" >&2
`;
}

function createManagedAppSetupScriptBat(
  name: string,
  appDir: string,
  projectDir: string,
): string {
  const projectRef = appProjectReference(appDir, projectDir).replaceAll(
    "/",
    "\\",
  );
  return `@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "SETUP_NAME=%~nx0"
set "APP_ID=${name.toLowerCase()}"
if not exist ".\\%SETUP_NAME%" (
  echo Unable to confirm app setup location. 1>&2
  exit /b 1
)
if not exist ".\\deno.json" (
  echo Alteran app setup requires .\\deno.json 1>&2
  exit /b 1
)
if not exist ".\\app.json" (
  echo Alteran app setup requires .\\app.json 1>&2
  exit /b 1
)
${batchAppJsonIdCheck("echo Alteran app setup requires app.json id")}

set "PROJECT_DIR=%APP_DIR%${projectRef}"
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"
set "ROOT_SETUP=%PROJECT_DIR%\\setup.bat"

if not exist "%ROOT_SETUP%" (
  echo Alteran app setup requires %ROOT_SETUP% 1>&2
  exit /b 1
)

call "%ROOT_SETUP%" "%PROJECT_DIR%"
exit /b %ERRORLEVEL%
`;
}

export async function ensureManagedAppScripts(
  projectDir: string,
  name: string,
  appDirOverride?: string,
): Promise<void> {
  const appDir = appDirOverride ?? join(projectDir, "apps", name);
  await writeExecutableIfNeeded(
    join(appDir, "setup"),
    createManagedAppSetupScript(name, appDir, projectDir),
  );
  await writeTextFileIfChanged(
    join(appDir, "setup.bat"),
    createManagedAppSetupScriptBat(name, appDir, projectDir),
  );
  await writeExecutableIfNeeded(
    join(appDir, "app"),
    createDevAppLauncher(name, appDir, projectDir),
  );
  await writeTextFileIfChanged(
    join(appDir, "app.bat"),
    createDevAppLauncherBat(name, appDir, projectDir),
  );
}

function createStandaloneSetupScript(appId: string): string {
  const launcher = createStandaloneAppLauncher(appId).trimEnd();
  const launcherBat = createStandaloneAppLauncherBat(appId).trimEnd();
  return `#!/usr/bin/env sh
set -eu

SCRIPT_PATH=$0
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
APP_ID="${appId}"
cd "$APP_DIR"

[ -f "./deno.json" ] || { printf '%s\\n' "Standalone app setup requires ./deno.json" >&2; exit 1; }
[ -f "./app.json" ] || { printf '%s\\n' "Standalone app setup requires ./app.json" >&2; exit 1; }
grep -Eq '"id"[[:space:]]*:[[:space:]]*"'$APP_ID'"' "./app.json" || {
  printf '%s\\n' "Standalone app setup requires app.json id '$APP_ID'" >&2
  exit 1
}

cat > "./app" <<'ALTERAN_STANDALONE_APP'
${launcher}
ALTERAN_STANDALONE_APP
chmod +x "./app"

cat > "./app.bat" <<'ALTERAN_STANDALONE_APP_BAT'
${launcherBat}
ALTERAN_STANDALONE_APP_BAT

UNAME_S=$(uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M=$(uname -m)

case "$UNAME_S" in
  darwin*) ALTERAN_OS="macos" ;;
  linux*) ALTERAN_OS="linux" ;;
  msys*|mingw*|cygwin*) ALTERAN_OS="windows" ;;
  *) ALTERAN_OS="$UNAME_S" ;;
esac

case "$UNAME_M" in
  x86_64|amd64) ALTERAN_ARCH="x64" ;;
  arm64|aarch64) ALTERAN_ARCH="arm64" ;;
  *) ALTERAN_ARCH="$UNAME_M" ;;
esac

DENO_RUNTIME_ROOT="$APP_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH"
LOCAL_DENO="$DENO_RUNTIME_ROOT/bin/deno"

resolve_deno_target() {
  case "$ALTERAN_OS-$ALTERAN_ARCH" in
    macos-x64) printf '%s' "x86_64-apple-darwin" ;;
    macos-arm64) printf '%s' "aarch64-apple-darwin" ;;
    linux-x64) printf '%s' "x86_64-unknown-linux-gnu" ;;
    linux-arm64) printf '%s' "aarch64-unknown-linux-gnu" ;;
    windows-x64) printf '%s' "x86_64-pc-windows-msvc" ;;
    windows-arm64) printf '%s' "aarch64-pc-windows-msvc" ;;
    *) return 1 ;;
  esac
}

if [ -z "${"${"}DENO_SOURCES:-}" ]; then
  DENO_SOURCES="https://dl.deno.land/release"
fi

split_sources() {
  printf '%s\\n' "$1" | tr ';' ' '
}

if [ -x "$LOCAL_DENO" ]; then
  exit 0
fi

if command -v deno >/dev/null 2>&1; then
  mkdir -p "$DENO_RUNTIME_ROOT/bin" "$DENO_RUNTIME_ROOT/cache"
  cp "$(command -v deno)" "$LOCAL_DENO"
  chmod +x "$LOCAL_DENO"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
  printf '%s\\n' "Standalone app setup requires curl and unzip to materialize local Deno." >&2
  exit 1
fi

DENO_TARGET=$(resolve_deno_target) || {
  printf '%s\\n' "Unsupported platform for standalone app setup: $ALTERAN_OS-$ALTERAN_ARCH" >&2
  exit 1
}

DENO_VERSION=""
for source in $(split_sources "$DENO_SOURCES"); do
  if DENO_VERSION=$(curl -fsSL "${"${"}source%/}/release-latest.txt" 2>/dev/null); then
    break
  fi
done

[ -n "$DENO_VERSION" ] || {
  printf '%s\\n' "Failed to resolve latest Deno version from DENO_SOURCES." >&2
  exit 1
}

mkdir -p "$DENO_RUNTIME_ROOT/bin"
ARCHIVE_NAME="deno-$DENO_TARGET.zip"
ARCHIVE_PATH="$DENO_RUNTIME_ROOT/$ARCHIVE_NAME"

for source in $(split_sources "$DENO_SOURCES"); do
  if curl -fsSL "${"${"}source%/}/$DENO_VERSION/$ARCHIVE_NAME" -o "$ARCHIVE_PATH" && unzip -oq "$ARCHIVE_PATH" -d "$DENO_RUNTIME_ROOT/bin"; then
    rm -f "$ARCHIVE_PATH"
    chmod +x "$LOCAL_DENO"
    mkdir -p "$DENO_RUNTIME_ROOT/cache"
    exit 0
  fi
  rm -f "$ARCHIVE_PATH"
done

printf '%s\\n' "Failed to download local Deno for standalone app setup." >&2
exit 1
`;
}

function createStandaloneSetupScriptBat(appId: string): string {
  const launcherBat = createStandaloneAppLauncherBat(appId).trimEnd();
  const launcherWriteBlock = renderBatchFileWriteBlock("app.bat", launcherBat);
  return `@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "APP_ID=${appId}"

if not exist ".\\deno.json" (
  echo Standalone app setup requires .\\deno.json 1>&2
  exit /b 1
)
if not exist ".\\app.json" (
  echo Standalone app setup requires .\\app.json 1>&2
  exit /b 1
)
${batchAppJsonIdCheck("echo Standalone app setup requires app.json id")}

${launcherWriteBlock}

set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"
set "DENO_RUNTIME_ROOT=%APP_DIR%\\.runtime\\deno\\windows-%ALTERAN_ARCH%"
set "LOCAL_DENO=%DENO_RUNTIME_ROOT%\\bin\\deno.exe"

if not defined DENO_SOURCES set "DENO_SOURCES=https://dl.deno.land/release"
set "DENO_SOURCES_LIST=%DENO_SOURCES:;= %"
if exist "%LOCAL_DENO%" exit /b 0

where deno >nul 2>nul
if %ERRORLEVEL%==0 (
  for /f "usebackq delims=" %%I in (\`where deno 2^>nul\`) do (
    if not exist "%DENO_RUNTIME_ROOT%\\bin" mkdir "%DENO_RUNTIME_ROOT%\\bin" >nul 2>nul
    if not exist "%DENO_RUNTIME_ROOT%\\cache" mkdir "%DENO_RUNTIME_ROOT%\\cache" >nul 2>nul
    copy /y "%%~I" "%LOCAL_DENO%" >nul
    exit /b 0
  )
)

for %%S in (%DENO_SOURCES_LIST%) do (
  set "DENO_VERSION="
  for /f "usebackq delims=" %%V in (\`curl.exe -fsSL "%%~S/release-latest.txt" 2^>nul\`) do (
    set "DENO_VERSION=%%V"
    goto :standalone_have_version
  )
  goto :standalone_next_source
  :standalone_have_version
  if not exist "%DENO_RUNTIME_ROOT%\\bin" mkdir "%DENO_RUNTIME_ROOT%\\bin" >nul 2>nul
  if not exist "%DENO_RUNTIME_ROOT%\\cache" mkdir "%DENO_RUNTIME_ROOT%\\cache" >nul 2>nul
  if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set "DENO_TARGET=aarch64-pc-windows-msvc"
  ) else (
    set "DENO_TARGET=x86_64-pc-windows-msvc"
  )
  set "DENO_ZIP=%DENO_RUNTIME_ROOT%\\deno.zip"
  curl.exe -fsSL "%%~S/%DENO_VERSION%/deno-%DENO_TARGET%.zip" -o "%DENO_ZIP%" >nul 2>nul
  if errorlevel 1 goto :standalone_next_source
  tar.exe -xf "%DENO_ZIP%" -C "%DENO_RUNTIME_ROOT%\\bin" >nul 2>nul
  if errorlevel 1 (
    del /q "%DENO_ZIP%" >nul 2>nul
    goto :standalone_next_source
  )
  del /q "%DENO_ZIP%" >nul 2>nul
  if exist "%LOCAL_DENO%" exit /b 0
  :standalone_next_source
)

echo Failed to download local Deno for standalone app setup. 1>&2
exit /b 1
`;
}

function createStandaloneAppLauncher(appId: string): string {
  return `#!/usr/bin/env sh
set -eu

SCRIPT_PATH=$0
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)
APP_ID="${appId}"
cd "$APP_DIR"

LAUNCHER_NAME=$(basename -- "$SCRIPT_PATH")
[ -f "./$LAUNCHER_NAME" ] || { printf '%s\\n' "Unable to confirm app launcher location." >&2; exit 1; }
[ -f "./deno.json" ] || { printf '%s\\n' "Standalone app launcher requires ./deno.json" >&2; exit 1; }
[ -f "./app.json" ] || { printf '%s\\n' "Standalone app launcher requires ./app.json" >&2; exit 1; }
grep -Eq '"id"[[:space:]]*:[[:space:]]*"'$APP_ID'"' "./app.json" || {
  printf '%s\\n' "Standalone app launcher requires app.json id '$APP_ID'" >&2
  exit 1
}

UNAME_S=$(uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M=$(uname -m)

case "$UNAME_S" in
  darwin*) ALTERAN_OS="macos" ;;
  linux*) ALTERAN_OS="linux" ;;
  msys*|mingw*|cygwin*) ALTERAN_OS="windows" ;;
  *) ALTERAN_OS="$UNAME_S" ;;
esac

case "$UNAME_M" in
  x86_64|amd64) ALTERAN_ARCH="x64" ;;
  arm64|aarch64) ALTERAN_ARCH="arm64" ;;
  *) ALTERAN_ARCH="$UNAME_M" ;;
esac

LOCAL_DENO="$APP_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/bin/deno"

if [ ! -x "$LOCAL_DENO" ]; then
  sh "./setup" >&2
fi

[ -x "$LOCAL_DENO" ] || {
  printf '%s\\n' "Standalone app launcher requires local Deno. Setup did not produce $LOCAL_DENO" >&2
  exit 1
}

export DENO_DIR="$APP_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/cache"
exec "$LOCAL_DENO" task --config "./deno.json" app -- "$@"
`;
}

function createStandaloneAppLauncherBat(appId: string): string {
  return `@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "APP_ID=${appId}"

if not exist ".\\app.bat" (
  echo Unable to confirm app launcher location. 1>&2
  exit /b 1
)
if not exist ".\\deno.json" (
  echo Standalone app launcher requires .\\deno.json 1>&2
  exit /b 1
)
if not exist ".\\app.json" (
  echo Standalone app launcher requires .\\app.json 1>&2
  exit /b 1
)
${batchAppJsonIdCheck("echo Standalone app launcher requires app.json id")}

set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"
set "LOCAL_DENO=%APP_DIR%\\.runtime\\deno\\windows-%ALTERAN_ARCH%\\bin\\deno.exe"

if not exist "%LOCAL_DENO%" call ".\\setup.bat"
if not exist "%LOCAL_DENO%" (
  echo Standalone app launcher requires local Deno. Setup did not produce %LOCAL_DENO% 1>&2
  exit /b 1
)

set "DENO_DIR=%APP_DIR%\\.runtime\\deno\\windows-%ALTERAN_ARCH%\\cache"
"%LOCAL_DENO%" task --config ".\\deno.json" app -- %*
exit /b %ERRORLEVEL%
`;
}

export async function createAppScaffold(
  projectDir: string,
  name: string,
): Promise<void> {
  const appDir = join(projectDir, "apps", name);
  await ensureDir(join(appDir, "core"));
  await ensureDir(join(appDir, "libs"));
  await ensureDir(join(appDir, "view"));

  await writeTextFileIfChanged(
    join(appDir, "app.json"),
    `${
      JSON.stringify(
        {
          name,
          id: name.toLowerCase(),
          version: "0.1.0",
          title: name,
          standalone: false,
          view: { enabled: false },
          entry: {
            core: "./core/mod.ts",
            view: "./view",
            app: "app",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(appDir, "deno.json"),
    `${
      JSON.stringify(
        {
          tasks: {
            core: "deno run -A ./core/mod.ts",
            view: "deno eval \"console.log('Alteran view placeholder')\"",
            app: "deno task core",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(appDir, "core", "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("App ${name} started", { args });
}

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(
    join(appDir, "view", "README.md"),
    `# ${name} view

This directory is intentionally reserved for future Alteran view integration.
`,
  );

  await writeTextFileIfChanged(join(appDir, "libs", ".keep"), "");
  await ensureManagedAppScripts(projectDir, name);
}

export async function createStandaloneAppScaffold(path: string): Promise<void> {
  const name = basename(path);
  const appId = name.toLowerCase();
  await ensureDir(join(path, "core"));
  await ensureDir(join(path, "libs"));
  await ensureDir(join(path, "view"));

  await writeTextFileIfChanged(
    join(path, "app.json"),
    `${
      JSON.stringify(
        {
          name,
          id: name.toLowerCase(),
          version: "0.1.0",
          title: name,
          standalone: true,
          view: { enabled: false },
          entry: {
            core: "./core/mod.ts",
            view: "./view",
            app: "app",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(path, "deno.json"),
    `${
      JSON.stringify(
        {
          tasks: {
            core: "deno run -A ./core/mod.ts",
            view: "deno eval \"console.log('Alteran view placeholder')\"",
            app: "deno task core",
          },
        },
        null,
        2,
      )
    }\n`,
  );

  await writeTextFileIfChanged(
    join(path, "core", "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("Standalone app ${name} started", { args });
}

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(join(path, "libs", ".keep"), "");
  await writeTextFileIfChanged(
    join(path, ".gitignore"),
    createStandaloneAppGitignore(),
  );
  await writeExecutableIfNeeded(
    join(path, "setup"),
    createStandaloneSetupScript(appId),
  );
  await writeTextFileIfChanged(
    join(path, "setup.bat"),
    createStandaloneSetupScriptBat(appId),
  );
  await writeExecutableIfNeeded(join(path, "app"), createStandaloneAppLauncher(appId));
  await writeTextFileIfChanged(
    join(path, "app.bat"),
    createStandaloneAppLauncherBat(appId),
  );
  await writeTextFileIfChanged(
    join(path, "view", "README.md"),
    `# ${name} view

Reserved for future Alteran view support.
`,
  );
}

export async function createToolScaffold(
  projectDir: string,
  name: string,
): Promise<void> {
  const entryPath = join(projectDir, "tools", `${name}.ts`);
  const helperDir = join(projectDir, "tools", name);
  await ensureDir(helperDir);

  await writeTextFileIfChanged(
    entryPath,
    `import { main } from "./${name}/mod.ts";

if (import.meta.main) {
  await main(Deno.args);
}
`,
  );

  await writeTextFileIfChanged(
    join(helperDir, "mod.ts"),
    `export async function main(args: string[]): Promise<void> {
  console.log("Tool ${name} started", { args });
}
`,
  );
}
