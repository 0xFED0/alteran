export interface EnvTemplateInput {
  runtimeDir: string;
  cacheDir: string;
  platformDir: string;
  denoBinDir: string;
  wrapperBinDir: string;
  shellWrapper: string;
  batchWrapper: string;
  appAliases: string[];
  toolAliases: string[];
  shellAliases: string[];
}

export function renderShellEnv(input: EnvTemplateInput): string {
  return [
    `export ALTERAN_HOME="${input.runtimeDir}"`,
    `export DENO_DIR="${input.cacheDir}"`,
    `export DENO_INSTALL_ROOT="${input.platformDir}"`,
    `export PATH="${input.denoBinDir}:$PATH"`,
    `alteran() { "${input.shellWrapper}" "$@"; }`,
    "alias alt='alteran'",
    "alias arun='alteran run'",
    "alias atask='alteran task'",
    "alias atest='alteran test'",
    "alias ax='alteran x'",
    "alias adeno='alteran deno'",
    ...input.appAliases,
    ...input.toolAliases,
    ...input.shellAliases,
    "",
  ].join("\n");
}

export function renderBatchEnv(input: EnvTemplateInput): string {
  return [
    "@echo off",
    `set "ALTERAN_HOME=${input.runtimeDir}"`,
    `set "DENO_DIR=${input.cacheDir}"`,
    `set "DENO_INSTALL_ROOT=${input.platformDir}"`,
    `set "PATH=${input.wrapperBinDir};${input.denoBinDir};%PATH%"`,
    `doskey alteran=call "${input.batchWrapper}" $*`,
    `doskey alt=call "${input.batchWrapper}" $*`,
    `doskey arun=call "${input.batchWrapper}" run $*`,
    `doskey atask=call "${input.batchWrapper}" task $*`,
    `doskey atest=call "${input.batchWrapper}" test $*`,
    `doskey ax=call "${input.batchWrapper}" x $*`,
    `doskey adeno=call "${input.batchWrapper}" deno $*`,
    ...input.appAliases,
    ...input.toolAliases,
    ...input.shellAliases,
    "",
  ].join("\r\n");
}

export interface CliWrapperTemplateInput {
  projectDir: string;
  runtimeDir: string;
  denoExe: string;
  alteranEntry: string;
}

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

export function renderShellCliWrapper(
  input: CliWrapperTemplateInput,
): string {
  return `#!/usr/bin/env sh
set -u

PROJECT_DIR=${shellLiteral(input.projectDir)}
RUNTIME_DIR=${shellLiteral(input.runtimeDir)}
DENO_EXE=${shellLiteral(input.denoExe)}
ALTERAN_ENTRY=${shellLiteral(input.alteranEntry)}

create_session_file() {
  temp_root=\${TMPDIR:-/tmp}/alteran-postrun
  mkdir -p "$temp_root"
  mktemp "$temp_root/session.XXXXXX"
}

copy_back_if_possible() {
  source_path=$1
  destination_path=$2
  [ -f "$source_path" ] || return 0
  destination_dir=$(dirname "$destination_path")
  [ -d "$destination_dir" ] || return 0
  cp "$source_path" "$destination_path" 2>/dev/null || true
}

run_main() {
  "$DENO_EXE" run -A "$ALTERAN_ENTRY" "$@"
}

command_name=\${1:-}
session_file=
case "$command_name" in
  clean|compact)
    session_file=$(create_session_file)
    ALTERAN_POSTRUN_SESSION_FILE="$session_file" run_main "$@"
    status=$?
    ;;
  *)
    exec "$DENO_EXE" run -A "$ALTERAN_ENTRY" "$@"
    ;;
esac

[ -n "$session_file" ] || exit "$status"
[ -s "$session_file" ] || {
  rm -f "$session_file"
  exit "$status"
}

. "$session_file"
rm -f "$session_file"

if [ -n "\${ALTERAN_POSTRUN_HOOK_PATH-}" ] && [ -f "$ALTERAN_POSTRUN_HOOK_PATH" ]; then
  postrun_temp_dir=$(mktemp -d "\${TMPDIR:-/tmp}/alteran-postrun-\${ALTERAN_POSTRUN_SESSION_DIR}.XXXXXX")
  export ALTERAN_POSTRUN_LOG="$postrun_temp_dir/postrun.log"
  export ALTERAN_POSTRUN_MSG="$postrun_temp_dir/postrun.msg"

  {
    printf '%s\\n' "intent: \${ALTERAN_POSTRUN_INTENT-}"
    printf '%s\\n' "hook: $ALTERAN_POSTRUN_HOOK_PATH"
    printf '%s\\n' "--- begin postrun script ---"
    cat "$ALTERAN_POSTRUN_HOOK_PATH"
    printf '%s\\n' "--- end postrun script ---"
  } >"$ALTERAN_POSTRUN_LOG"

  if sh "$ALTERAN_POSTRUN_HOOK_PATH" >>"$ALTERAN_POSTRUN_LOG" 2>&1; then
    postrun_status=0
  else
    postrun_status=$?
  fi

  if [ -f "$ALTERAN_POSTRUN_MSG" ]; then
    cat "$ALTERAN_POSTRUN_MSG"
  fi

  if [ -n "\${ALTERAN_POSTRUN_LOG_DIR-}" ] && [ -d "$ALTERAN_POSTRUN_LOG_DIR" ]; then
    copy_back_if_possible "$ALTERAN_POSTRUN_LOG" "$ALTERAN_POSTRUN_LOG_DIR/postrun.log"
    copy_back_if_possible "$ALTERAN_POSTRUN_MSG" "$ALTERAN_POSTRUN_LOG_DIR/postrun.msg"
  fi

  if [ "$postrun_status" -eq 0 ]; then
    rm -rf "$ALTERAN_POSTRUN_HOOK_DIR"
    rmdir "$(dirname "$ALTERAN_POSTRUN_HOOK_DIR")" 2>/dev/null || true
    rmdir "$RUNTIME_DIR" 2>/dev/null || true
  fi

  rm -rf "$postrun_temp_dir"

  if [ "$status" -eq 0 ]; then
    exit "$postrun_status"
  fi
fi

exit "$status"
`;
}

export function renderBatchCliWrapper(
  input: CliWrapperTemplateInput,
): string {
  return `@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=${batchLiteral(input.projectDir)}"
set "RUNTIME_DIR=${batchLiteral(input.runtimeDir)}"
set "DENO_EXE=${batchLiteral(input.denoExe)}"
set "ALTERAN_ENTRY=${batchLiteral(input.alteranEntry)}"

set "COMMAND_NAME=%~1"
set "SESSION_FILE="

if /I "%COMMAND_NAME%"=="clean" goto :with_postrun
if /I "%COMMAND_NAME%"=="compact" goto :with_postrun
goto :direct

:with_postrun
set "POSTRUN_TEMP_ROOT=%TEMP%\\alteran-postrun"
if not exist "%POSTRUN_TEMP_ROOT%" mkdir "%POSTRUN_TEMP_ROOT%" >nul 2>nul
set "SESSION_FILE=%POSTRUN_TEMP_ROOT%\\session-%RANDOM%%RANDOM%%RANDOM%.cmd"
set "ALTERAN_POSTRUN_SESSION_FILE=%SESSION_FILE%"
"%DENO_EXE%" run -A "%ALTERAN_ENTRY%" %*
set "STATUS=%ERRORLEVEL%"
goto :after_main

:direct
"%DENO_EXE%" run -A "%ALTERAN_ENTRY%" %*
exit /b %ERRORLEVEL%

:after_main
if not exist "%SESSION_FILE%" exit /b %STATUS%
call "%SESSION_FILE%"
del /q "%SESSION_FILE%" >nul 2>nul

if defined ALTERAN_POSTRUN_HOOK_PATH if exist "%ALTERAN_POSTRUN_HOOK_PATH%" (
  set "POSTRUN_TEMP_DIR=%TEMP%\\alteran-postrun-%ALTERAN_POSTRUN_SESSION_DIR%-%RANDOM%%RANDOM%"
  mkdir "%POSTRUN_TEMP_DIR%" >nul 2>nul
  set "ALTERAN_POSTRUN_LOG=%POSTRUN_TEMP_DIR%\\postrun.log"
  set "ALTERAN_POSTRUN_MSG=%POSTRUN_TEMP_DIR%\\postrun.msg"

  (
    echo intent: %ALTERAN_POSTRUN_INTENT%
    echo hook: %ALTERAN_POSTRUN_HOOK_PATH%
    echo --- begin postrun script ---
    type "%ALTERAN_POSTRUN_HOOK_PATH%"
    echo --- end postrun script ---
  ) > "%ALTERAN_POSTRUN_LOG%"

  call "%ALTERAN_POSTRUN_HOOK_PATH%" >> "%ALTERAN_POSTRUN_LOG%" 2>&1
  set "POSTRUN_STATUS=%ERRORLEVEL%"

  if exist "%ALTERAN_POSTRUN_MSG%" type "%ALTERAN_POSTRUN_MSG%"

  if defined ALTERAN_POSTRUN_LOG_DIR if exist "%ALTERAN_POSTRUN_LOG_DIR%" (
    if exist "%ALTERAN_POSTRUN_LOG%" copy /y "%ALTERAN_POSTRUN_LOG%" "%ALTERAN_POSTRUN_LOG_DIR%\\postrun.log" >nul 2>nul
    if exist "%ALTERAN_POSTRUN_MSG%" copy /y "%ALTERAN_POSTRUN_MSG%" "%ALTERAN_POSTRUN_LOG_DIR%\\postrun.msg" >nul 2>nul
  )

  if "%POSTRUN_STATUS%"=="0" (
    rmdir /s /q "%ALTERAN_POSTRUN_HOOK_DIR%" >nul 2>nul
    for %%I in ("%ALTERAN_POSTRUN_HOOK_DIR%\\..") do rmdir "%%~fI" >nul 2>nul
    rmdir "%RUNTIME_DIR%" >nul 2>nul
  )

  rmdir /s /q "%POSTRUN_TEMP_DIR%" >nul 2>nul

  if "%STATUS%"=="0" exit /b %POSTRUN_STATUS%
)

exit /b %STATUS%
`;
}
