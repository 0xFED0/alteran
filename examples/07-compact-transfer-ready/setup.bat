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
      findstr /b /c:"ALTERAN_SRC=" "%%~fF" >nul 2>nul && set "ALTERAN_SRC_DOTENV=%%~fF"
    )
  )
)

if defined ALTERAN_SRC if defined ALTERAN_SRC_DOTENV call :resolve_alteran_src
if not defined DENO_SOURCES set "DENO_SOURCES=https://dl.deno.land/release"
if not defined ALTERAN_RUN_SOURCES (
  if defined ALTERAN_SOURCES (
    set "ALTERAN_RUN_SOURCES=%ALTERAN_SOURCES%"
  ) else (
    set "ALTERAN_RUN_SOURCES=jsr:@alteran/alteran"
  )
)
if not defined ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES set "ALTERAN_BOOTSTRAP_ARCHIVE_SOURCES=https://github.com/0xFED0/alteran/releases/download/v0.1.10/alteran-v0.1.10.zip"
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

set "SCRIPT_DENO=%SCRIPT_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%\bin\deno.exe"
set "TARGET_DENO=%TARGET_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%\bin\deno.exe"
set "DENO_RUNTIME_ROOT=%TARGET_DIR%\.runtime\deno\%ALTERAN_OS%-%ALTERAN_ARCH%"
set "ARCHIVE_TEMP_ROOT="

set "BOOTSTRAP_DENO="
if exist "%SCRIPT_DENO%" set "BOOTSTRAP_DENO=%SCRIPT_DENO%"
if not defined BOOTSTRAP_DENO if exist "%TARGET_DENO%" set "BOOTSTRAP_DENO=%TARGET_DENO%"
if not defined BOOTSTRAP_DENO (
  where deno >nul 2>nul
  if %ERRORLEVEL%==0 (
    for /f "usebackq delims=" %%I in (`where deno 2^>nul`) do (
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
    call :download_deno_from_source "%%~S"
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
    call :download_archive_source "%%~S"
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

:resolve_alteran_src
set "ALTERAN_SRC_VALUE=%ALTERAN_SRC%"
for %%I in ("%ALTERAN_SRC_DOTENV%") do set "ALTERAN_SRC_BASE=%%~dpI"
if "%ALTERAN_SRC_VALUE%"=="~" (
  set "ALTERAN_SRC=%USERPROFILE%"
  goto :eof
)
if "%ALTERAN_SRC_VALUE:~0,2%"=="~/" (
  for %%I in ("%USERPROFILE%\%ALTERAN_SRC_VALUE:~2%") do set "ALTERAN_SRC=%%~fI"
  goto :eof
)
if "%ALTERAN_SRC_VALUE:~0,2%"=="~\" (
  for %%I in ("%USERPROFILE%\%ALTERAN_SRC_VALUE:~2%") do set "ALTERAN_SRC=%%~fI"
  goto :eof
)
call :is_absolute_path "%ALTERAN_SRC_VALUE%" ALTERAN_SRC_IS_ABSOLUTE
if "%ALTERAN_SRC_IS_ABSOLUTE%"=="1" (
  for %%I in ("%ALTERAN_SRC_VALUE%") do set "ALTERAN_SRC=%%~fI"
) else (
  for %%I in ("%ALTERAN_SRC_BASE%%ALTERAN_SRC_VALUE%") do set "ALTERAN_SRC=%%~fI"
)
goto :eof

:is_absolute_path
set "%~2=0"
if "%~1"=="" goto :eof
set "ABSOLUTE_PATH_CANDIDATE=%~1"
if "%ABSOLUTE_PATH_CANDIDATE:~1,1%"==":" set "%~2=1"
if "%ABSOLUTE_PATH_CANDIDATE:~0,2%"=="\\" set "%~2=1"
goto :eof

:resolve_latest_deno_version
set "DENO_SOURCE=%~1"
set "DENO_VERSION="
for /f "usebackq delims=" %%V in (`curl.exe -fsSL "%DENO_SOURCE%/release-latest.txt" 2^>nul`) do (
  set "DENO_VERSION=%%V"
  goto :eof
)
if /I "%DENO_SOURCE:~-8%"=="/release" (
  set "DENO_SOURCE_ALT=%DENO_SOURCE:~0,-8%"
  for /f "usebackq delims=" %%V in (`curl.exe -fsSL "%DENO_SOURCE_ALT%/release-latest.txt" 2^>nul`) do (
    set "DENO_VERSION=%%V"
    goto :eof
  )
)
goto :eof

:download_deno_from_source
set "DENO_SOURCE=%~1"
call :resolve_latest_deno_version "%DENO_SOURCE%"
if not defined DENO_VERSION goto :eof
if not exist "%DENO_RUNTIME_ROOT%\bin" mkdir "%DENO_RUNTIME_ROOT%\bin" >nul 2>nul
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
  set "DENO_TARGET=aarch64-pc-windows-msvc"
) else (
  set "DENO_TARGET=x86_64-pc-windows-msvc"
)
set "DENO_ARCHIVE=%DENO_RUNTIME_ROOT%\deno.zip"
curl.exe -fsSL "%DENO_SOURCE%/%DENO_VERSION%/deno-%DENO_TARGET%.zip" -o "%DENO_ARCHIVE%" >nul 2>nul
if errorlevel 1 goto :download_deno_cleanup
tar.exe -xf "%DENO_ARCHIVE%" -C "%DENO_RUNTIME_ROOT%\bin" >nul 2>nul
:download_deno_cleanup
if exist "%DENO_ARCHIVE%" del /q "%DENO_ARCHIVE%" >nul 2>nul
goto :eof

:download_archive_source
set "ARCHIVE_SOURCE=%~1"
set "ARCHIVE_TEMP_ROOT="
set "ARCHIVE_ENTRY="
set "ARCHIVE_TEMP_ROOT=%TEMP%\alteran-archive-%RANDOM%%RANDOM%%RANDOM%"
set "ARCHIVE_ZIP=%ARCHIVE_TEMP_ROOT%\alteran.zip"
set "ARCHIVE_EXTRACT_DIR=%ARCHIVE_TEMP_ROOT%\extract"
if exist "%ARCHIVE_TEMP_ROOT%" rmdir /s /q "%ARCHIVE_TEMP_ROOT%" >nul 2>nul
mkdir "%ARCHIVE_EXTRACT_DIR%" >nul 2>nul || goto :archive_source_cleanup
curl.exe -fsSL "%ARCHIVE_SOURCE%" -o "%ARCHIVE_ZIP%" >nul 2>nul || goto :archive_source_cleanup
tar.exe -xf "%ARCHIVE_ZIP%" -C "%ARCHIVE_EXTRACT_DIR%" >nul 2>nul || goto :archive_source_cleanup
if exist "%ARCHIVE_EXTRACT_DIR%\alteran.ts" if exist "%ARCHIVE_EXTRACT_DIR%\src\alteran\mod.ts" (
  set "ARCHIVE_ENTRY=%ARCHIVE_EXTRACT_DIR%\alteran.ts"
  goto :eof
)
for /r "%ARCHIVE_EXTRACT_DIR%" %%F in (mod.ts) do (
  call :try_archive_entry "%%~fF"
  if defined ARCHIVE_ENTRY goto :eof
)
:archive_source_cleanup
if defined ARCHIVE_TEMP_ROOT if exist "%ARCHIVE_TEMP_ROOT%" rmdir /s /q "%ARCHIVE_TEMP_ROOT%" >nul 2>nul
set "ARCHIVE_TEMP_ROOT="
set "ARCHIVE_ENTRY="
goto :eof

:try_archive_entry
echo(%~1| findstr /i /r /c:"[\\/]src[\\/]alteran[\\/]mod\.ts$" >nul || goto :eof
for %%R in ("%~dp1..\..") do set "ARCHIVE_ROOT=%%~fR"
if exist "%ARCHIVE_ROOT%\alteran.ts" set "ARCHIVE_ENTRY=%ARCHIVE_ROOT%\alteran.ts"
goto :eof
