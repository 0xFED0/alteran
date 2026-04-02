@echo off
setlocal

if "%~1"=="" (
  set "TARGET_INPUT=%~dp0."
) else (
  set "TARGET_INPUT=%~1"
)

for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"
for %%I in ("%TARGET_INPUT%") do set "TARGET_DIR=%%~fI"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%" >nul 2>nul

for %%F in ("%TARGET_DIR%\.env" "%SCRIPT_DIR%\.env") do (
  if exist "%%~fF" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%%~fF") do (
      if not defined %%A set "%%A=%%B"
    )
    if not defined ALTERAN_SRC_DOTENV (
      findstr /b /c:"ALTERAN_SRC=" /c:"ALTERUN_SRC=" "%%~fF" >nul 2>nul && set "ALTERAN_SRC_DOTENV=%%~fF"
    )
  )
)

if not defined ALTERAN_SRC if defined ALTERUN_SRC set "ALTERAN_SRC=%ALTERUN_SRC%"
if defined ALTERAN_SRC if defined ALTERAN_SRC_DOTENV (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$value=$env:ALTERAN_SRC; $baseDir=Split-Path '%ALTERAN_SRC_DOTENV%' -Parent; if ($value -eq '~') { $value=$HOME } elseif ($value.StartsWith('~/') -or $value.StartsWith('~\')) { $value=Join-Path $HOME $value.Substring(2) } elseif (-not [System.IO.Path]::IsPathRooted($value)) { $value=Join-Path $baseDir $value }; [System.IO.Path]::GetFullPath($value)"`) do (
    set "ALTERAN_SRC=%%I"
  )
)
if not defined DENO_SOURCES set "DENO_SOURCES=https://dl.deno.land/release"
if not defined ALTERAN_RUN_SOURCES (
  if defined ALTERAN_SOURCES (
    set "ALTERAN_RUN_SOURCES=%ALTERAN_SOURCES%"
  ) else (
    set "ALTERAN_RUN_SOURCES="
  )
)
if not defined ALTERAN_ARCHIVE_SOURCES set "ALTERAN_ARCHIVE_SOURCES="

set "ALTERAN_OS=windows"
set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"

set "SCRIPT_DENO=%SCRIPT_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%\bin\deno.exe"
set "TARGET_DENO=%TARGET_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%\bin\deno.exe"
set "DENO_RUNTIME_ROOT=%TARGET_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%"
set "ARCHIVE_TEMP_ROOT="

if exist "%SCRIPT_DENO%" (
  set "BOOTSTRAP_DENO=%SCRIPT_DENO%"
) else if exist "%TARGET_DENO%" (
  set "BOOTSTRAP_DENO=%TARGET_DENO%"
) else (
  where deno >nul 2>nul
  if %ERRORLEVEL%==0 (
    for /f "usebackq delims=" %%I in (`where deno`) do (
      set "BOOTSTRAP_DENO=%%I"
      goto :have_deno
    )
  )
  if not exist "%DENO_RUNTIME_ROOT%" mkdir "%DENO_RUNTIME_ROOT%" >nul 2>nul
  if "%DENO_SOURCES: =%"=="" (
    echo Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running setup. 1>&2
    exit /b 1
  )
  for %%S in (%DENO_SOURCES%) do (
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
if exist "%SCRIPT_DIR%\alteran.ts" if exist "%SCRIPT_DIR%\src\alteran\mod.ts" (
  set "ALTERAN_ENTRY=%SCRIPT_DIR%\alteran.ts"
  goto :have_alteran
)
if exist "%SCRIPT_DIR%\.runtime\alteran\mod.ts" (
  set "ALTERAN_ENTRY=%SCRIPT_DIR%\.runtime\alteran\mod.ts"
  goto :have_alteran
)
if exist "%TARGET_DIR%\.runtime\alteran\mod.ts" (
  set "ALTERAN_ENTRY=%TARGET_DIR%\.runtime\alteran\mod.ts"
  goto :have_alteran
)
if defined ALTERAN_SRC if exist "%ALTERAN_SRC%\alteran\mod.ts" (
  for %%I in ("%ALTERAN_SRC%\..\alteran.ts") do set "ALTERAN_SOURCE_ENTRY=%%~fI"
  if exist "%ALTERAN_SOURCE_ENTRY%" (
    set "ALTERAN_ENTRY=%ALTERAN_SOURCE_ENTRY%"
  ) else (
    set "ALTERAN_ENTRY=%ALTERAN_SRC%\alteran\mod.ts"
  )
  goto :have_alteran
)

if not "%ALTERAN_RUN_SOURCES: =%"=="" (
  for %%S in (%ALTERAN_RUN_SOURCES%) do (
    "%BOOTSTRAP_DENO%" run -A "%%~S" help >nul 2>nul
    if not errorlevel 1 (
      set "ALTERAN_ENTRY=%%~S"
      goto :have_alteran
    )
  )
)

if not "%ALTERAN_ARCHIVE_SOURCES: =%"=="" (
  for %%S in (%ALTERAN_ARCHIVE_SOURCES%) do (
    set "ARCHIVE_ENTRY="
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('alteran-archive-' + [Guid]::NewGuid().ToString('N'));" ^
      "$zipPath = Join-Path $tempRoot 'alteran.zip';" ^
      "$extractDir = Join-Path $tempRoot 'extract';" ^
      "New-Item -ItemType Directory -Force -Path $extractDir | Out-Null;" ^
      "Invoke-WebRequest -UseBasicParsing -Uri '%%~S' -OutFile $zipPath;" ^
      "Expand-Archive -Force -Path $zipPath -DestinationPath $extractDir;" ^
      "$mod = Get-ChildItem -Path $extractDir -Recurse -File -Filter mod.ts | Where-Object { $_.FullName -match '[\\/]src[\\/]alteran[\\/]mod\.ts$' } | Select-Object -First 1;" ^
      "if ($mod) {" ^
      "  $root = Split-Path (Split-Path (Split-Path $mod.FullName -Parent) -Parent) -Parent;" ^
      "  $entry = Join-Path $root 'alteran.ts';" ^
      "  if (Test-Path $entry) { Write-Output $entry; Write-Output $tempRoot | Out-File -Append -Encoding ascii '%TEMP%\\alteran-archive-root.txt' }" ^
      "}" > "%TEMP%\alteran-archive-entry.txt" 2>nul
    if exist "%TEMP%\alteran-archive-entry.txt" (
      set /p ARCHIVE_ENTRY=<"%TEMP%\alteran-archive-entry.txt"
      del /q "%TEMP%\alteran-archive-entry.txt" >nul 2>nul
    )
    if exist "%TEMP%\alteran-archive-root.txt" (
      set /p ARCHIVE_TEMP_ROOT=<"%TEMP%\alteran-archive-root.txt"
      del /q "%TEMP%\alteran-archive-root.txt" >nul 2>nul
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
if defined ARCHIVE_TEMP_ROOT powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force '%ARCHIVE_TEMP_ROOT%' -ErrorAction SilentlyContinue" >nul 2>nul
exit /b %STATUS%
