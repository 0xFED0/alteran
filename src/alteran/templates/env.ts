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
    "doskey alteran=",
    "doskey alt=",
    "doskey arun=",
    "doskey atask=",
    "doskey atest=",
    "doskey ax=",
    "doskey adeno=",
    ...input.appAliases,
    ...input.toolAliases,
    ...input.shellAliases,
    "",
  ].join("\r\n");
}

function powerShellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderPowerShellCommandShim(name: string, command: string): string {
  return [
    `function global:${name} {`,
    `  __alteran_invoke_alias ${powerShellLiteral(command)} $args`,
    "}",
  ].join("\n");
}

export function renderPowerShellEnv(input: EnvTemplateInput): string {
  return [
    `$env:ALTERAN_HOME = ${powerShellLiteral(input.runtimeDir)}`,
    `$env:DENO_DIR = ${powerShellLiteral(input.cacheDir)}`,
    `$env:DENO_INSTALL_ROOT = ${powerShellLiteral(input.platformDir)}`,
    `$env:PATH = ${powerShellLiteral(`${input.wrapperBinDir};${input.denoBinDir};`)} + $env:PATH`,
    "function global:__alteran_invoke_alias {",
    "  param([string]$Command, [object[]]$RestArgs)",
    "  if ($null -eq $RestArgs -or $RestArgs.Count -eq 0) {",
    "    Invoke-Expression $Command",
    "    return",
    "  }",
    "  $quotedArgs = foreach ($arg in $RestArgs) {",
    '    if ($null -eq $arg) { \'""\'; continue }',
    "    $text = [string]$arg",
    "    if ($text -match '[\\s\"`]') {",
    "      '\"' + $text.Replace('`', '``').Replace('\"', '`\"') + '\"'",
    "    } else {",
    "      $text",
    "    }",
    "  }",
    "  $suffix = ($quotedArgs -join ' ')",
    '  Invoke-Expression "$Command $suffix"',
    "}",
    `function global:alteran { & ${powerShellLiteral(input.batchWrapper)} @args }`,
    "Set-Alias -Scope Global alt alteran",
    renderPowerShellCommandShim("arun", "alteran run"),
    renderPowerShellCommandShim("atask", "alteran task"),
    renderPowerShellCommandShim("atest", "alteran test"),
    renderPowerShellCommandShim("ax", "alteran x"),
    renderPowerShellCommandShim("adeno", "alteran deno"),
    ...input.appAliases,
    ...input.toolAliases,
    ...input.shellAliases,
    "",
  ].join("\n");
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
exec "$DENO_EXE" run -A "$ALTERAN_ENTRY" "$@"
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
if not defined ALTERAN_WINDOWS_WRAPPER_HANDOFF if /I "%COMMAND_NAME%"=="refresh" goto :handoff_wrapper
if /I "%COMMAND_NAME%"=="deno" if /I "%~2"=="clean" goto :direct_deno_clean
if /I "%COMMAND_NAME%"=="clean" goto :with_cleanup_batch
if /I "%COMMAND_NAME%"=="compact" goto :with_cleanup_batch
goto :direct

:handoff_wrapper
set "HANDOFF_TEMP_ROOT=%TEMP%\\alteran-wrapper"
if not exist "%HANDOFF_TEMP_ROOT%" mkdir "%HANDOFF_TEMP_ROOT%" >nul 2>nul
set "HANDOFF_WRAPPER=%HANDOFF_TEMP_ROOT%\\alteran-%RANDOM%%RANDOM%%RANDOM%.bat"
copy /y "%~f0" "%HANDOFF_WRAPPER%" >nul 2>nul
if errorlevel 1 exit /b 1
set "ALTERAN_WINDOWS_WRAPPER_HANDOFF=1"
cmd /d /c call "%HANDOFF_WRAPPER%" %*
set "STATUS=%ERRORLEVEL%"
del /q "%HANDOFF_WRAPPER%" >nul 2>nul
exit /b %STATUS%

:direct_deno_clean
shift
"%DENO_EXE%" %*
exit /b %ERRORLEVEL%

:with_cleanup_batch
set "TMP_CLEANUP_ROOT=%TEMP%\\alteran-cleanup-bat"
if not exist "%TMP_CLEANUP_ROOT%" mkdir "%TMP_CLEANUP_ROOT%" >nul 2>nul
if not exist "%TMP_CLEANUP_ROOT%" exit /b 1
set "ALTERAN_TMP_CLEANUP_BAT=%TMP_CLEANUP_ROOT%\\cleanup-%RANDOM%%RANDOM%%RANDOM%.bat"
set "ALTERAN_WRAPPER_PROJECT_DIR=%PROJECT_DIR%"
if exist "%ALTERAN_TMP_CLEANUP_BAT%" del /f /q "%ALTERAN_TMP_CLEANUP_BAT%" >nul 2>nul
"%DENO_EXE%" run -A "%ALTERAN_ENTRY%" %*
set "STATUS=%ERRORLEVEL%"
if not "%STATUS%"=="0" exit /b %STATUS%
if not exist "%ALTERAN_TMP_CLEANUP_BAT%" exit /b 0
echo [handoff] "%ALTERAN_TMP_CLEANUP_BAT%"
"%ALTERAN_TMP_CLEANUP_BAT%"

:direct
"%DENO_EXE%" run -A "%ALTERAN_ENTRY%" %*
exit /b %ERRORLEVEL%
`;
}
