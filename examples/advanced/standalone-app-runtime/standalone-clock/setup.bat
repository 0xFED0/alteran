@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "APP_ID=standalone-clock"

if not exist ".\deno.json" (
  echo Standalone app setup requires .\deno.json 1>&2
  exit /b 1
)
if not exist ".\app.json" (
  echo Standalone app setup requires .\app.json 1>&2
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$content = [System.IO.File]::ReadAllText((Resolve-Path '.\app.json'));" ^
  "if ($content -notmatch '"id"\s*:\s*"%APP_ID%"') { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Standalone app setup requires app.json id "%APP_ID%" 1>&2
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$content = @'
@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
set "APP_ID=standalone-clock"

if not exist ".\app.bat" (
  echo Unable to confirm app launcher location. 1>&2
  exit /b 1
)
if not exist ".\deno.json" (
  echo Standalone app launcher requires .\deno.json 1>&2
  exit /b 1
)
if not exist ".\app.json" (
  echo Standalone app launcher requires .\app.json 1>&2
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$content = [System.IO.File]::ReadAllText((Resolve-Path '.\app.json'));" ^
  "if ($content -notmatch '"id"\s*:\s*"%APP_ID%"') { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Standalone app launcher requires app.json id "%APP_ID%" 1>&2
  exit /b 1
)

set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"
set "LOCAL_DENO=%APP_DIR%\.runtime\deno\windows-%ALTERAN_ARCH%\bin\deno.exe"

if not exist "%LOCAL_DENO%" call ".\setup.bat"
if not exist "%LOCAL_DENO%" (
  echo Standalone app launcher requires local Deno. Setup did not produce %LOCAL_DENO% 1>&2
  exit /b 1
)

set "DENO_DIR=%APP_DIR%\.runtime\deno\windows-%ALTERAN_ARCH%\cache"
"%LOCAL_DENO%" task --config ".\deno.json" app -- %*
exit /b %ERRORLEVEL%
'@;" ^
  "[System.IO.File]::WriteAllText((Join-Path (Resolve-Path '.').Path 'app.bat'), ($content -replace \"`n\", \"`r`n\"))" >nul 2>nul
if errorlevel 1 (
  echo Standalone app setup could not regenerate app.bat 1>&2
  exit /b 1
)

set "ALTERAN_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ALTERAN_ARCH=arm64"
set "DENO_RUNTIME_ROOT=%APP_DIR%\.runtime\deno\windows-%ALTERAN_ARCH%"
set "LOCAL_DENO=%DENO_RUNTIME_ROOT%\bin\deno.exe"

if not defined DENO_SOURCES set "DENO_SOURCES=https://dl.deno.land/release"
set "DENO_SOURCES_LIST=%DENO_SOURCES:;= %"
if exist "%LOCAL_DENO%" exit /b 0

where deno >nul 2>nul
if %ERRORLEVEL%==0 (
  for /f "usebackq delims=" %%I in (`where deno`) do (
    if not exist "%DENO_RUNTIME_ROOT%\bin" mkdir "%DENO_RUNTIME_ROOT%\bin" >nul 2>nul
    if not exist "%DENO_RUNTIME_ROOT%\cache" mkdir "%DENO_RUNTIME_ROOT%\cache" >nul 2>nul
    copy /y "%%~I" "%LOCAL_DENO%" >nul
    exit /b 0
  )
)

for %%S in (%DENO_SOURCES_LIST%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$source='%%~S'.TrimEnd('/');" ^
    "$version=(Invoke-RestMethod -UseBasicParsing ($source + '/release-latest.txt')).Trim();" ^
    "$target = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'aarch64-pc-windows-msvc' } else { 'x86_64-pc-windows-msvc' };" ^
    "$binDir = Join-Path '%DENO_RUNTIME_ROOT%' 'bin';" ^
    "$zipPath = Join-Path '%DENO_RUNTIME_ROOT%' 'deno.zip';" ^
    "New-Item -ItemType Directory -Force -Path $binDir | Out-Null;" ^
    "New-Item -ItemType Directory -Force -Path (Join-Path '%DENO_RUNTIME_ROOT%' 'cache') | Out-Null;" ^
    "Invoke-WebRequest -UseBasicParsing -Uri ($source + '/' + $version + '/deno-' + $target + '.zip') -OutFile $zipPath;" ^
    "Expand-Archive -Force -Path $zipPath -DestinationPath $binDir;" ^
    "Remove-Item $zipPath -Force;" >nul 2>nul
  if exist "%LOCAL_DENO%" exit /b 0
)

echo Failed to download local Deno for standalone app setup. 1>&2
exit /b 1
