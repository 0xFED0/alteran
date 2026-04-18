import { ALTERAN_VERSION } from "../version.ts";

const DEFAULT_GITHUB_RELEASE_ARCHIVE_TEMPLATE =
  "https://github.com/0xFED0/alteran/releases/download/v{ALTERAN_VERSION}/alteran-v{ALTERAN_VERSION}.zip";
const DEFAULT_RUN_SOURCE = "jsr:@alteran/alteran";

export function renderArchiveSourceTemplate(
  template: string,
  version = ALTERAN_VERSION,
): string {
  return template.replaceAll("{ALTERAN_VERSION}", version);
}

export function getDefaultAlteranArchiveSourceTemplates(): string[] {
  return [DEFAULT_GITHUB_RELEASE_ARCHIVE_TEMPLATE];
}

export function getDefaultAlteranArchiveSources(
  version = ALTERAN_VERSION,
): string[] {
  return getDefaultAlteranArchiveSourceTemplates().map((template) =>
    renderArchiveSourceTemplate(template, version)
  );
}

export function getDefaultBootstrapArchiveSources(
  version = ALTERAN_VERSION,
): string[] {
  return getDefaultAlteranArchiveSources(version);
}

function renderShellSourceList(values: string[]): string {
  return values.map((value) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")
  ).join(";");
}

function renderBatchSourceList(values: string[]): string {
  return values.map((value) =>
    value
      .replaceAll("%", "%%")
      .replaceAll('"', '""')
  ).join(";");
}

const SETUP_TEMPLATE = `#!/usr/bin/env sh

resolve_env_path() {
  base_dir=$1
  value=$2
  case "$value" in
    "~") printf '%s\\n' "$HOME" ;;
    "~/"*) printf '%s/%s\\n' "$HOME" "\${value#~/}" ;;
    /*) printf '%s\\n' "$value" ;;
    *)
      normalized_base=$(CDPATH= cd -- "$base_dir" && pwd)
      if resolved=$(CDPATH= cd -- "$normalized_base/$value" 2>/dev/null && pwd); then
        printf '%s\\n' "$resolved"
      else
        printf '%s/%s\\n' "$normalized_base" "$value"
      fi
      ;;
  esac
}

load_dotenv_file() {
  dot_env=$1
  [ -f "$dot_env" ] || return 0
  dot_env_dir=$(CDPATH= cd -- "$(dirname -- "$dot_env")" && pwd)
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key=\${line%%=*}
    value=\${line#*=}
    key=$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    value=$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -n "$key" ] || continue
    case "$key" in
      *[!A-Za-z0-9_]*) continue ;;
    esac
    case "$key" in
      ALTERAN_SRC)
        [ -z "$value" ] || value=$(resolve_env_path "$dot_env_dir" "$value")
        ;;
    esac
    eval "existing=\\\${$key+x}"
    [ "$existing" = "x" ] || export "$key=$value"
  done < "$dot_env"
}

is_var_defined() {
  eval "case \\\${$1+__alteran_set__} in __alteran_set__) return 0 ;; *) return 1 ;; esac"
}

abspath() {
  path=\${1:-.}
  case "$path" in
    "~") printf '%s\\n' "$HOME" ;;
    "~/"*) printf '%s/%s\\n' "$HOME" "\${path#~/}" ;;
    /*) printf '%s\\n' "$path" ;;
    *) printf '%s/%s\\n' "$PWD" "$path" ;;
  esac
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_DIR=$(abspath "\${1:-$SCRIPT_DIR}")
mkdir -p "$TARGET_DIR" >/dev/null 2>&1 || true

load_dotenv_file "$TARGET_DIR/.env"
load_dotenv_file "$SCRIPT_DIR/.env"

if ! is_var_defined DENO_SOURCES; then
  DENO_SOURCES="https://dl.deno.land/release"
  export DENO_SOURCES
fi
if ! is_var_defined ALTERAN_RUN_SOURCES; then
  if is_var_defined ALTERAN_SOURCES; then
    ALTERAN_RUN_SOURCES=\${ALTERAN_SOURCES-}
  else
    ALTERAN_RUN_SOURCES="__DEFAULT_RUN_SOURCE__"
  fi
  export ALTERAN_RUN_SOURCES
fi
if ! is_var_defined ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES; then
  ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES="__DEFAULT_BOOTSTRAP_ARCHIVE_SOURCES__"
  export ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES
fi

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

SCRIPT_DENO="$SCRIPT_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/bin/deno"
TARGET_DENO="$TARGET_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH/bin/deno"
DENO_RUNTIME_ROOT="$TARGET_DIR/.runtime/deno/$ALTERAN_OS-$ALTERAN_ARCH"
BOOTSTRAP_DENO=""
ALTERAN_ENTRY=""
ARCHIVE_TEMP_ROOT=""

cleanup() {
  [ -z "$ARCHIVE_TEMP_ROOT" ] || rm -rf "$ARCHIVE_TEMP_ROOT"
}

trap cleanup EXIT INT TERM

is_blank() {
  [ -z "$(printf '%s' "\${1:-}" | tr -d '[:space:]')" ]
}

split_sources() {
  printf '%s\\n' "\${1:-}" | tr ';' ' '
}

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

latest_metadata_urls_for_source() {
  source=$1
  normalized=\${source%/}
  printf '%s\\n' "$normalized/release-latest.txt"
  case "$normalized" in
    */release) printf '%s\\n' "\${normalized%/release}/release-latest.txt" ;;
  esac
}

resolve_latest_deno_version() {
  if is_blank "$DENO_SOURCES"; then
    printf '%s\\n' "Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running setup." >&2
    return 1
  fi
  for source in $(split_sources "$DENO_SOURCES"); do
    for latest_url in $(latest_metadata_urls_for_source "$source"); do
      if DENO_VERSION=$(curl -fsSL "$latest_url" 2>/dev/null); then
        printf '%s' "$DENO_VERSION"
        return 0
      fi
    done
  done
  printf '%s\\n' "Failed to resolve the latest Deno version from all configured sources. Check your internet connection or extend DENO_SOURCES." >&2
  return 1
}

download_local_deno() {
  if is_blank "$DENO_SOURCES"; then
    printf '%s\\n' "Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running setup." >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
    printf '%s\\n' "Alteran setup requires either a global deno or local curl+unzip to download a project-local runtime." >&2
    return 1
  fi
  DENO_TARGET=$(resolve_deno_target) || {
    printf '%s\\n' "Unsupported platform for local Deno bootstrap: $ALTERAN_OS-$ALTERAN_ARCH" >&2
    return 1
  }
  DENO_VERSION=$(resolve_latest_deno_version) || return 1
  DENO_ARCHIVE_NAME="deno-$DENO_TARGET.zip"
  DENO_ARCHIVE="$DENO_RUNTIME_ROOT/$DENO_ARCHIVE_NAME"
  mkdir -p "$DENO_RUNTIME_ROOT/bin"
  for source in $(split_sources "$DENO_SOURCES"); do
    DENO_URL="\${source%/}/$DENO_VERSION/$DENO_ARCHIVE_NAME"
    if curl -fsSL "$DENO_URL" -o "$DENO_ARCHIVE" && unzip -oq "$DENO_ARCHIVE" -d "$DENO_RUNTIME_ROOT/bin"; then
      rm -f "$DENO_ARCHIVE"
      chmod +x "$TARGET_DENO"
      return 0
    fi
    rm -f "$DENO_ARCHIVE"
  done
  printf '%s\\n' "Failed to download Deno from all configured sources. Check your internet connection or extend DENO_SOURCES." >&2
  return 1
}

bootstrap_alteran_from_run_sources() {
  if is_blank "$ALTERAN_RUN_SOURCES"; then
    printf '%s\\n' "Cannot bootstrap Alteran from runnable sources because ALTERAN_RUN_SOURCES is empty. Set ALTERAN_RUN_SOURCES before running setup." >&2
    return 1
  fi
  for source in $(split_sources "$ALTERAN_RUN_SOURCES"); do
    if "$BOOTSTRAP_DENO" run -A "$source" help >/dev/null 2>&1; then
      ALTERAN_ENTRY="$source"
      return 0
    fi
  done
  printf '%s\\n' "Failed to bootstrap Alteran from all configured runnable sources. Check your internet connection or extend ALTERAN_RUN_SOURCES." >&2
  return 1
}

find_archive_alteran_entry() {
  extract_dir=$1
  if [ -f "$extract_dir/alteran.ts" ] && [ -f "$extract_dir/src/alteran/mod.ts" ]; then
    printf '%s' "$extract_dir/alteran.ts"
    return 0
  fi
  mod_path=$(find "$extract_dir" -type f -path '*/src/alteran/mod.ts' ! -path '*/dist/*' 2>/dev/null | head -n 1 || true)
  [ -n "$mod_path" ] || return 1
  archive_root=$(dirname "$(dirname "$(dirname "$mod_path")")")
  entry_path="$archive_root/alteran.ts"
  [ -f "$entry_path" ] || return 1
  printf '%s' "$entry_path"
}

resolve_local_alteran_entry_from_source() {
  source_root=\${1:-}
  [ -n "$source_root" ] || return 1
  [ -f "$source_root/alteran/mod.ts" ] || return 1
  source_entry="$(dirname "$source_root")/alteran.ts"
  if [ -f "$source_entry" ]; then
    printf '%s' "$source_entry"
    return 0
  fi
  printf '%s' "$source_root/alteran/mod.ts"
}

bootstrap_alteran_from_archive_sources() {
  combined_archive_sources="$ALTERAN_ARCHIVE_SOURCES"
  if ! is_blank "$ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES"; then
    if is_blank "$combined_archive_sources"; then
      combined_archive_sources="$ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES"
    else
      combined_archive_sources="$combined_archive_sources;$ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES"
    fi
  fi
  if is_blank "$combined_archive_sources"; then
    printf '%s\\n' "Cannot download Alteran from archive sources because ALTERAN_ARCHIVE_SOURCES and ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES are empty. Set ALTERAN_ARCHIVE_SOURCES before running setup." >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
    printf '%s\\n' "Archive-based Alteran bootstrap requires curl and unzip." >&2
    return 1
  fi
  for source in $(split_sources "$combined_archive_sources"); do
    temp_root=$(mktemp -d "\${TMPDIR:-/tmp}/alteran-archive.XXXXXX") || return 1
    archive_path="$temp_root/alteran.zip"
    extract_dir="$temp_root/extract"
    mkdir -p "$extract_dir"
    if curl -fsSL "$source" -o "$archive_path" && unzip -oq "$archive_path" -d "$extract_dir"; then
      archive_entry=$(find_archive_alteran_entry "$extract_dir" || true)
      if [ -n "$archive_entry" ]; then
        ARCHIVE_TEMP_ROOT="$temp_root"
        ALTERAN_ENTRY="$archive_entry"
        return 0
      fi
    fi
    rm -rf "$temp_root"
  done
  printf '%s\\n' "Failed to download Alteran from all configured archive sources. Check your internet connection or extend ALTERAN_ARCHIVE_SOURCES." >&2
  return 1
}

main() {
  if [ -x "$SCRIPT_DENO" ]; then
    BOOTSTRAP_DENO="$SCRIPT_DENO"
  elif [ -x "$TARGET_DENO" ]; then
    BOOTSTRAP_DENO="$TARGET_DENO"
  elif command -v deno >/dev/null 2>&1; then
    BOOTSTRAP_DENO=$(command -v deno)
  else
    mkdir -p "$DENO_RUNTIME_ROOT"
    download_local_deno || return 1
    BOOTSTRAP_DENO="$TARGET_DENO"
  fi

  if [ -f "$SCRIPT_DIR/alteran.ts" ] && [ -f "$SCRIPT_DIR/src/alteran/mod.ts" ]; then
    ALTERAN_ENTRY="$SCRIPT_DIR/alteran.ts"
  elif [ -f "$SCRIPT_DIR/.runtime/alteran/mod.ts" ]; then
    ALTERAN_ENTRY="$SCRIPT_DIR/.runtime/alteran/mod.ts"
  elif [ -f "$TARGET_DIR/.runtime/alteran/mod.ts" ]; then
    ALTERAN_ENTRY="$TARGET_DIR/.runtime/alteran/mod.ts"
  elif ALTERAN_SOURCE_ENTRY=$(resolve_local_alteran_entry_from_source "\${ALTERAN_SRC-}" || true) && [ -n "$ALTERAN_SOURCE_ENTRY" ]; then
    ALTERAN_ENTRY="$ALTERAN_SOURCE_ENTRY"
  else
    bootstrap_alteran_from_run_sources || bootstrap_alteran_from_archive_sources || {
      printf '%s\\n' "Failed to bootstrap Alteran. Check your internet connection or extend ALTERAN_RUN_SOURCES / ALTERAN_ARCHIVE_SOURCES." >&2
      return 1
    }
  fi

  "$BOOTSTRAP_DENO" run -A "$ALTERAN_ENTRY" setup "$TARGET_DIR"
}

main "$@"
`;

function shellLiteral(value: string): string {
  return `"${
    value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("$", "\\$")
      .replaceAll("`", "\\`")
  }"`;
}

function batchLiteral(value: string): string {
  return value.replaceAll('"', '""');
}

const ACTIVATE_TEMPLATE = `#!/usr/bin/env sh

PROJECT_DIR=__PROJECT_DIR__
DENO_EXE=__DENO_EXE__
ALTERAN_ENTRY=__ALTERAN_ENTRY__
DENO_CACHE_DIR=__DENO_CACHE_DIR__

(return 0 2>/dev/null) || {
  printf '%s\\n' "Alteran activate must be sourced. Use: source ./activate" >&2
  exit 1
}

[ -x "$DENO_EXE" ] || {
  printf '%s\\n' "Alteran activate requires $DENO_EXE. Run ./setup first." >&2
  return 1
}
[ -f "$ALTERAN_ENTRY" ] || {
  printf '%s\\n' "Alteran activate requires $ALTERAN_ENTRY. Run ./setup first." >&2
  return 1
}

export DENO_DIR="$DENO_CACHE_DIR"
shellenv_output=$("$DENO_EXE" run -A "$ALTERAN_ENTRY" shellenv "$PROJECT_DIR") || return $?
eval "$shellenv_output"
`;

const SETUP_BAT_TEMPLATE = `@echo off
setlocal

if "%~1"=="" (
  set "TARGET_INPUT=%~dp0."
) else (
  set "TARGET_INPUT=%~1"
)

for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"
for %%I in ("%TARGET_INPUT%") do set "TARGET_DIR=%%~fI"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%" >nul 2>nul

for %%F in ("%TARGET_DIR%\\.env" "%SCRIPT_DIR%\\.env") do (
  if exist "%%~fF" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%%~fF") do (
      if not defined %%A set "%%A=%%B"
    )
    if not defined ALTERAN_SRC_DOTENV (
      findstr /b /c:"ALTERAN_SRC=" "%%~fF" >nul 2>nul && set "ALTERAN_SRC_DOTENV=%%~fF"
    )
  )
)

if defined ALTERAN_SRC if defined ALTERAN_SRC_DOTENV (
  for /f "usebackq delims=" %%I in (\`powershell -NoProfile -ExecutionPolicy Bypass -Command "$value=$env:ALTERAN_SRC; $baseDir=Split-Path '%ALTERAN_SRC_DOTENV%' -Parent; if ($value -eq '~') { $value=$HOME } elseif ($value.StartsWith('~/') -or $value.StartsWith('~\\')) { $value=Join-Path $HOME $value.Substring(2) } elseif (-not [System.IO.Path]::IsPathRooted($value)) { $value=Join-Path $baseDir $value }; [System.IO.Path]::GetFullPath($value)"\`) do (
    set "ALTERAN_SRC=%%I"
  )
)
if not defined DENO_SOURCES set "DENO_SOURCES=https://dl.deno.land/release"
if not defined ALTERAN_RUN_SOURCES (
  if defined ALTERAN_SOURCES (
    set "ALTERAN_RUN_SOURCES=%ALTERAN_SOURCES%"
  ) else (
    set "ALTERAN_RUN_SOURCES=__DEFAULT_RUN_SOURCE_BAT__"
  )
)
if not defined ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES set "ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES=__DEFAULT_BOOTSTRAP_ARCHIVE_SOURCES_BAT__"
if /I "%DENO_SOURCES%"=="__ALTERAN_EMPTY__" set "DENO_SOURCES="
if /I "%ALTERAN_SOURCES%"=="__ALTERAN_EMPTY__" set "ALTERAN_SOURCES="
if /I "%ALTERAN_RUN_SOURCES%"=="__ALTERAN_EMPTY__" set "ALTERAN_RUN_SOURCES="
if /I "%ALTERAN_ARCHIVE_SOURCES%"=="__ALTERAN_EMPTY__" set "ALTERAN_ARCHIVE_SOURCES="
if /I "%ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES%"=="__ALTERAN_EMPTY__" set "ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES="
set "DENO_SOURCES_LIST=%DENO_SOURCES:;= %"
set "ALTERAN_RUN_SOURCES_LIST=%ALTERAN_RUN_SOURCES:;= %"
set "ALTERAN_ARCHIVE_SOURCES_LIST=%ALTERAN_ARCHIVE_SOURCES:;= %"
set "ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES_LIST=%ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES:;= %"

set "ALTERAN_OS=windows"
set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"

set "SCRIPT_DENO=%SCRIPT_DIR%\\.runtime\\deno\\%ALTERAN_OS%-%ALTERAN_ARCH%\\bin\\deno.exe"
set "TARGET_DENO=%TARGET_DIR%\\.runtime\\deno\\%ALTERAN_OS%-%ALTERAN_ARCH%\\bin\\deno.exe"
set "DENO_RUNTIME_ROOT=%TARGET_DIR%\\.runtime\\deno\\%ALTERAN_OS%-%ALTERAN_ARCH%"
set "ARCHIVE_TEMP_ROOT="

if exist "%SCRIPT_DENO%" (
  set "BOOTSTRAP_DENO=%SCRIPT_DENO%"
) else if exist "%TARGET_DENO%" (
  set "BOOTSTRAP_DENO=%TARGET_DENO%"
) else (
  where deno >nul 2>nul
  if %ERRORLEVEL%==0 (
    for /f "usebackq delims=" %%I in (\`where deno 2^>nul\`) do (
      set "BOOTSTRAP_DENO=%%I"
      goto :have_deno
    )
  )
  if not exist "%DENO_RUNTIME_ROOT%" mkdir "%DENO_RUNTIME_ROOT%" >nul 2>nul
  if "%DENO_SOURCES: =%"=="" (
    echo Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running setup. 1>&2
    exit /b 1
  )
  for %%S in (%DENO_SOURCES_LIST%) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$source='%%~S'.TrimEnd('/');" ^
      "$latestUrls=@($source + '/release-latest.txt');" ^
      "if ($source.EndsWith('/release')) { $latestUrls += $source.Substring(0, $source.Length - 8).TrimEnd('/') + '/release-latest.txt' };" ^
      "$version=$null;" ^
      "foreach ($latest in $latestUrls) { try { $version=(Invoke-RestMethod -UseBasicParsing $latest).Trim(); if ($version) { break } } catch {} }" ^
      "if (-not $version) { exit 1 };" ^
      "$target = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'aarch64-pc-windows-msvc' } else { 'x86_64-pc-windows-msvc' };" ^
      "$binDir = Join-Path '%DENO_RUNTIME_ROOT%' 'bin';" ^
      "$zipPath = Join-Path '%DENO_RUNTIME_ROOT%' 'deno.zip';" ^
      "New-Item -ItemType Directory -Force -Path $binDir | Out-Null;" ^
      "Invoke-WebRequest -UseBasicParsing -Uri ($source + '/' + $version + '/deno-' + $target + '.zip') -OutFile $zipPath;" ^
      "Expand-Archive -Force -Path $zipPath -DestinationPath $binDir;" ^
      "Remove-Item $zipPath -Force;" >nul 2>nul
    if exist "%TARGET_DENO%" (
      set "BOOTSTRAP_DENO=%TARGET_DENO%"
      goto :have_deno
    )
  )
  echo Failed to download Deno from all configured sources. Check your internet connection or extend DENO_SOURCES. 1>&2
  exit /b 1
)

:have_deno
if exist "%SCRIPT_DIR%\\alteran.ts" if exist "%SCRIPT_DIR%\\src\\alteran\\mod.ts" (
  set "ALTERAN_ENTRY=%SCRIPT_DIR%\\alteran.ts"
  goto :have_alteran
)
if exist "%SCRIPT_DIR%\\.runtime\\alteran\\mod.ts" (
  set "ALTERAN_ENTRY=%SCRIPT_DIR%\\.runtime\\alteran\\mod.ts"
  goto :have_alteran
)
if exist "%TARGET_DIR%\\.runtime\\alteran\\mod.ts" (
  set "ALTERAN_ENTRY=%TARGET_DIR%\\.runtime\\alteran\\mod.ts"
  goto :have_alteran
)
if defined ALTERAN_SRC if exist "%ALTERAN_SRC%\\alteran\\mod.ts" (
  for %%I in ("%ALTERAN_SRC%\\..\\alteran.ts") do set "ALTERAN_SOURCE_ENTRY=%%~fI"
  if exist "%ALTERAN_SOURCE_ENTRY%" (
    set "ALTERAN_ENTRY=%ALTERAN_SOURCE_ENTRY%"
  ) else (
    set "ALTERAN_ENTRY=%ALTERAN_SRC%\\alteran\\mod.ts"
  )
  goto :have_alteran
)

if not "%ALTERAN_RUN_SOURCES_LIST: =%"=="" (
  for %%S in (%ALTERAN_RUN_SOURCES_LIST%) do (
    "%BOOTSTRAP_DENO%" run -A "%%~S" help >nul 2>nul
    if not errorlevel 1 (
      set "ALTERAN_ENTRY=%%~S"
      goto :have_alteran
    )
  )
)

set "ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST=%ALTERAN_ARCHIVE_SOURCES_LIST%"
if not "%ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES_LIST: =%"=="" (
  if "%ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST: =%"=="" (
    set "ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST=%ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES_LIST%"
  ) else (
    set "ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST=%ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST% %ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES_LIST%"
  )
)

if not "%ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST: =%"=="" (
  for %%S in (%ALTERAN_COMBINED_ARCHIVE_SOURCES_LIST%) do (
    set "ARCHIVE_ENTRY="
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('alteran-archive-' + [Guid]::NewGuid().ToString('N'));" ^
      "$zipPath = Join-Path $tempRoot 'alteran.zip';" ^
      "$extractDir = Join-Path $tempRoot 'extract';" ^
      "New-Item -ItemType Directory -Force -Path $extractDir | Out-Null;" ^
      "Invoke-WebRequest -UseBasicParsing -Uri '%%~S' -OutFile $zipPath;" ^
      "Expand-Archive -Force -Path $zipPath -DestinationPath $extractDir;" ^
      "$mod = Get-ChildItem -Path $extractDir -Recurse -File -Filter mod.ts | Where-Object { $_.FullName -match '[\\\\/]src[\\\\/]alteran[\\\\/]mod\\.ts$' } | Select-Object -First 1;" ^
      "if ($mod) {" ^
      "  $root = Split-Path (Split-Path (Split-Path $mod.FullName -Parent) -Parent) -Parent;" ^
      "  $entry = Join-Path $root 'alteran.ts';" ^
      "  if (Test-Path $entry) { Write-Output $entry; Write-Output $tempRoot | Out-File -Append -Encoding ascii '%TEMP%\\\\alteran-archive-root.txt' }" ^
      "}" > "%TEMP%\\alteran-archive-entry.txt" 2>nul
    if exist "%TEMP%\\alteran-archive-entry.txt" (
      set /p ARCHIVE_ENTRY=<"%TEMP%\\alteran-archive-entry.txt"
      del /q "%TEMP%\\alteran-archive-entry.txt" >nul 2>nul
    )
    if exist "%TEMP%\\alteran-archive-root.txt" (
      set /p ARCHIVE_TEMP_ROOT=<"%TEMP%\\alteran-archive-root.txt"
      del /q "%TEMP%\\alteran-archive-root.txt" >nul 2>nul
    )
    if defined ARCHIVE_ENTRY (
      set "ALTERAN_ENTRY=%ARCHIVE_ENTRY%"
      goto :have_alteran
    )
  )
)

echo Failed to bootstrap Alteran. Check your internet connection or extend ALTERAN_RUN_SOURCES / ALTERAN_ARCHIVE_SOURCES. 1>&2
exit /b 1

:have_alteran
"%BOOTSTRAP_DENO%" run -A "%ALTERAN_ENTRY%" setup "%TARGET_DIR%"
set "STATUS=%ERRORLEVEL%"
if defined ARCHIVE_TEMP_ROOT if exist "%ARCHIVE_TEMP_ROOT%" rmdir /s /q "%ARCHIVE_TEMP_ROOT%" >nul 2>nul
exit /b %STATUS%
`;

const ACTIVATE_BAT_TEMPLATE = `@echo off
set "PROJECT_DIR=__PROJECT_DIR__"
set "DENO_EXE=__DENO_EXE__"
set "ALTERAN_ENTRY=__ALTERAN_ENTRY__"
set "DENO_DIR=__DENO_CACHE_DIR__"

if not exist "%DENO_EXE%" (
  echo Alteran activate requires %DENO_EXE%. Run setup first. 1>&2
  exit /b 1
)
if not exist "%ALTERAN_ENTRY%" (
  echo Alteran activate requires %ALTERAN_ENTRY%. Run setup first. 1>&2
  exit /b 1
)

set "ALTERAN_ENV_FILE=%TEMP%\\alteran-shellenv-%RANDOM%%RANDOM%.bat"
"%DENO_EXE%" run -A "%ALTERAN_ENTRY%" shellenv "%PROJECT_DIR%" --shell=batch > "%ALTERAN_ENV_FILE%"
if errorlevel 1 (
  set "STATUS=%ERRORLEVEL%"
  del /q "%ALTERAN_ENV_FILE%" >nul 2>nul
  exit /b %STATUS%
)

call "%ALTERAN_ENV_FILE%"
set "STATUS=%ERRORLEVEL%"
del /q "%ALTERAN_ENV_FILE%" >nul 2>nul
exit /b %STATUS%
`;

export function readSetupTemplate(version = ALTERAN_VERSION): Promise<string> {
  return Promise.resolve(
    SETUP_TEMPLATE
      .replace("__DEFAULT_RUN_SOURCE__", renderShellSourceList([DEFAULT_RUN_SOURCE]))
      .replace(
        "__DEFAULT_BOOTSTRAP_ARCHIVE_SOURCES__",
        renderShellSourceList(getDefaultBootstrapArchiveSources(version)),
      ),
  );
}

export function readSetupBatTemplate(
  version = ALTERAN_VERSION,
): Promise<string> {
  return Promise.resolve(
    SETUP_BAT_TEMPLATE
      .replace("__DEFAULT_RUN_SOURCE_BAT__", renderBatchSourceList([DEFAULT_RUN_SOURCE]))
      .replace(
        "__DEFAULT_BOOTSTRAP_ARCHIVE_SOURCES_BAT__",
        renderBatchSourceList(getDefaultBootstrapArchiveSources(version)),
      ),
  );
}

export interface ActivateTemplateInput {
  projectDir: string;
  denoExe: string;
  alteranEntry: string;
  denoCacheDir: string;
}

export function readActivateTemplate(
  input: ActivateTemplateInput,
): Promise<string> {
  return Promise.resolve(
    ACTIVATE_TEMPLATE
      .replace("__PROJECT_DIR__", shellLiteral(input.projectDir))
      .replace("__DENO_EXE__", shellLiteral(input.denoExe))
      .replace("__ALTERAN_ENTRY__", shellLiteral(input.alteranEntry))
      .replace("__DENO_CACHE_DIR__", shellLiteral(input.denoCacheDir)),
  );
}

export function readActivateBatTemplate(
  input: ActivateTemplateInput,
): Promise<string> {
  return Promise.resolve(
    ACTIVATE_BAT_TEMPLATE
      .replace("__PROJECT_DIR__", batchLiteral(input.projectDir))
      .replace("__DENO_EXE__", batchLiteral(input.denoExe))
      .replace("__ALTERAN_ENTRY__", batchLiteral(input.alteranEntry))
      .replace("__DENO_CACHE_DIR__", batchLiteral(input.denoCacheDir)),
  );
}
