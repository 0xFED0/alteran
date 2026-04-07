@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
if "%~1"=="" (
  set "TARGET_DIR=%SCRIPT_DIR%"
) else (
  set "TARGET_DIR=%~1"
)

for %%F in ("%TARGET_DIR%\.env" "%SCRIPT_DIR%\.env") do (
  if exist "%%~fF" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%%~fF") do (
      if not defined %%A set "%%A=%%B"
    )
  )
)

if not defined ALTERAN_SRC if defined ALTERUN_SRC set "ALTERAN_SRC=%ALTERUN_SRC%"

REM Configurable download source lists.
REM Override from the caller environment or .env if needed, for example:
REM   set "DENO_SOURCES=https://mirror-1.example/deno https://dl.deno.land/release"
REM   set "ALTERAN_RUN_SOURCES=jsr:@alteran https://mirror.example/alteran/alteran.ts"
REM   set "ALTERAN_ARCHIVE_SOURCES=https://github.com/org/repo/releases/download/v0.1.0/alteran-v0.1.0.zip"
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

set "DENO_RUNTIME_ROOT=%TARGET_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%"
set "LOCAL_DENO=%DENO_RUNTIME_ROOT%\bin\deno.exe"

if exist "%LOCAL_DENO%" (
  set "BOOTSTRAP_DENO=%LOCAL_DENO%"
) else (
  where deno >nul 2>nul
  if %ERRORLEVEL%==0 (
    for /f "usebackq delims=" %%i in (`where deno`) do (
      set "BOOTSTRAP_DENO=%%i"
      goto :have_deno
    )
  )

  if not exist "%DENO_RUNTIME_ROOT%" mkdir "%DENO_RUNTIME_ROOT%"
  if "%DENO_SOURCES: =%"=="" (
    echo Cannot download Deno because DENO_SOURCES is empty. Set DENO_SOURCES before running activate. 1>&2
    exit /b 1
  )
  for %%S in (%DENO_SOURCES%) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop';" ^
      "$binDir = Join-Path '%DENO_RUNTIME_ROOT%' 'bin';" ^
      "New-Item -ItemType Directory -Force -Path $binDir | Out-Null;" ^
      "$version = (Invoke-RestMethod -UseBasicParsing 'https://dl.deno.land/release-latest.txt').Trim();" ^
      "$zipPath = Join-Path $binDir 'deno.zip';" ^
      "$target = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'aarch64-pc-windows-msvc' } else { 'x86_64-pc-windows-msvc' };" ^
      "$url = '%%~S/' -replace '/+$','/';" ^
      "$url = $url + $version + '/deno-' + $target + '.zip';" ^
      "Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zipPath;" ^
      "tar.exe xf $zipPath -C $binDir;" ^
      "Remove-Item $zipPath -Force;" >nul 2>nul
    if exist "%LOCAL_DENO%" (
      set "BOOTSTRAP_DENO=%LOCAL_DENO%"
      goto :have_deno
    )
  )

  echo Failed to download Deno from all configured sources. Check your internet connection or extend DENO_SOURCES. 1>&2
  exit /b 1
)

:have_deno
  if exist "%TARGET_DIR%\.runtime\alteran\mod.ts" (
    set "ALTERAN_ENTRY=%TARGET_DIR%\.runtime\alteran\mod.ts"
  ) else (
  if exist "%SCRIPT_DIR%alteran.ts" (
    set "ALTERAN_ENTRY=%SCRIPT_DIR%alteran.ts"
  ) else (
    if not "%ALTERAN_RUN_SOURCES: =%"=="" (
      for %%S in (%ALTERAN_RUN_SOURCES%) do (
        "%BOOTSTRAP_DENO%" run -A "%%~S" init "%TARGET_DIR%"
        if exist "%TARGET_DIR%\.runtime\alteran\mod.ts" (
          set "ALTERAN_ENTRY=%TARGET_DIR%\.runtime\alteran\mod.ts"
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
          "$mod = Get-ChildItem -Path $extractDir -Recurse -File -Filter mod.ts | Where-Object { $_.FullName -match '[\\\\/]src[\\\\/]alteran[\\\\/]mod\\.ts$' } | Select-Object -First 1;" ^
          "if ($mod) {" ^
          "  $root = Split-Path (Split-Path (Split-Path $mod.FullName -Parent) -Parent) -Parent;" ^
          "  $entry = Join-Path $root 'alteran.ts';" ^
          "  if (Test-Path $entry) { Write-Output $entry }" ^
          "}" > "%TEMP%\\alteran-archive-entry.txt" 2>nul
        if exist "%TEMP%\\alteran-archive-entry.txt" (
          set /p ARCHIVE_ENTRY=<"%TEMP%\\alteran-archive-entry.txt"
          del /q "%TEMP%\\alteran-archive-entry.txt" >nul 2>nul
        )
        if defined ARCHIVE_ENTRY (
          "%BOOTSTRAP_DENO%" run -A "%ARCHIVE_ENTRY%" init "%TARGET_DIR%"
          if exist "%TARGET_DIR%\.runtime\alteran\mod.ts" (
            set "ALTERAN_ENTRY=%TARGET_DIR%\.runtime\alteran\mod.ts"
            goto :have_alteran
          )
        )
      )
    )
    if "%ALTERAN_RUN_SOURCES: =%"=="" if "%ALTERAN_ARCHIVE_SOURCES: =%"=="" (
      echo Cannot download Alteran because ALTERAN_RUN_SOURCES and ALTERAN_ARCHIVE_SOURCES are empty. Set at least one of them before running activate. 1>&2
      exit /b 1
    )
    echo Failed to download Alteran from all configured runnable and archive sources. Check your internet connection or extend ALTERAN_RUN_SOURCES / ALTERAN_ARCHIVE_SOURCES. 1>&2
    exit /b 1
  )
)

:have_alteran
"%BOOTSTRAP_DENO%" run -A "%ALTERAN_ENTRY%" init "%TARGET_DIR%"
if exist "%TARGET_DIR%\.runtime\alteran\mod.ts" set "ALTERAN_ENTRY=%TARGET_DIR%\.runtime\alteran\mod.ts"
call "%TARGET_DIR%\.runtime\env\enter-env.bat"
endlocal
