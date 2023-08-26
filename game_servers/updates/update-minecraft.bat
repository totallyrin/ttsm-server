::------------------------------------------------------------------------------
:: NAME
::     updatemcjar.bat
::
:: USAGE
::     updatemcjar.bat [options]
::
:: DESCRIPTION
::     A shell script for updating the Minecraft server jar file on Windows.
::     A batch port of updatemcjar.sh by Andrew Haskell.
::     (https://minecraft.gamepedia.com/Tutorials/Linux_server_update_script)
::
:: OPTIONAL ARGUMENTS
::     -f, --force      If the Target Version SHA1 matches the current
::                      file's SHA1, force the update anyway, implies --yes
::     -h, --help       Print this help message
::     --jar-path       Specify a different final JAR path, default is
::                      %JAR_PATH%
::     --manifest       Specify a different version manifest URL, default
::                      is %VERSION_MANIFEST%
::     --no-err         Suppress error messages (Dangerous!)
::     -s, --silent     Suppress script output, implies --yes
::     -t, --test       Test the Target Version SHA1 against the current
::                      file's SHA1 without changing any files
::     --temp-dir       Specify a different temporary directory,
::                      default is %TEMP_DIR%
::     -v, --version    Specify a different target version; without this
::                      parameter, the latest release version is used
::     -y, --yes        Skip update confirmation
::
:: REQUIREMENTS
::     cURL (https://curl.haxx.se/) - Included in Windows 10
::
:: AUTHOR
::     sintrode#4642 (/u/Shadow_Thief)
::
:: VERSION HISTORY
::     1.0 (2020-09-18) - Initial Version
::
:: NOTES
::     - This was originally going to be distributed under the WTFPL license,
::       but curl requires the MIT license
::     - You will still have to manually start your server
::------------------------------------------------------------------------------
:: Copyright (c) 2020 sintrode#4642
:: Permission is hereby granted, free of charge, to any person obtaining a copy
:: of this software and associated documentation files (the "Software"), to deal
:: in the Software without restriction, including without limitation the rights
:: to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
:: copies of the Software, and to permit persons to whom the Software is
:: furnished to do so, subject to the following conditions:
:: 
:: The above copyright notice and this permission notice shall be included in
:: all copies or substantial portions of the Software.
:: 
:: THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
:: IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
:: FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
:: AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
:: LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
:: OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
:: SOFTWARE.
::------------------------------------------------------------------------------
@echo off
setlocal enabledelayedexpansion

set "print_n=<nul set /p ="
:: Default settings (can be changed through parameters)
set "TEMP_DIR=%TEMP%\updatemc"
set "JAR_PATH=..\minecraft\server.jar"
set "VERSION_MANIFEST=https://launchermeta.mojang.com/mc/game/version_manifest.json"

:: Output paths
set "NORMAL_OUT="
set "ERROR_OUT="

:: Parameter flags
set "FLAG_FORCE="
set "FLAG_VERSION="
set "FLAG_CONFIRM="
set "FLAG_TEST="

:: Check script parameters
if "%~1"=="" goto :begin_script
:get_opts
if /i "%~1"=="-f" set /a FLAG_FORCE=1, FLAG_CONFIRM=1
if /i "%~1"=="--force" set /a FLAG_FORCE=1, FLAG_CONFIRM=1
if /i "%~1"=="-h" goto :usage
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="--jar-path" (set "JAR_PATH=%2" & shift)
if /i "%~1"=="--manifest" (set "VERSION_MANIFEST=%~2" & shift)
if /i "%~1"=="--no-err" set "ERROR_OUT=2>nul"
if /i "%~1"=="-s" set "NORMAL_OUT=1>nul"
if /i "%~1"=="--silent" set "NORMAL_OUT=1>nul"
if /i "%~1"=="-t" set "FLAG_TEST=1"
if /i "%~1"=="--test" set "FLAG_TEST=1"
if /i "%~1"=="-v" (set "FLAG_VERSION=%~2" & shift)
if /i "%~1"=="--version" (set "FLAG_VERSION=%~2" & shift)
if /i "%~1"=="-y" set "FLAG_CONFIRM=1"
if /i "%~1"=="--yes" set "FLAG_CONFIRM=1"
shift
if not "%~1"=="" goto :get_opts

if not defined JAR_PATH goto :usage
if not defined VERSION_MANIFEST goto :usage

:begin_script
%NORMAL_OUT% echo Clearing temp directory: %TEMP_DIR%
rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"
set "DOWNLOADED_JAR=%TEMP_DIR%\server.jar"
if exist "%DOWNLOADED_JAR%" del "%DOWNLOADED_JAR%"

%NORMAL_OUT% %print_n% Downloading Version Manifest...
curl -k -s %VERSION_MANIFEST% -o "%TEMP_DIR%\version_manifest.json"
if not exist "%TEMP_DIR%\version_manifest.json" (
	%ERROR_OUT% echo Download error. Exiting.
	exit /b 1
)
%NORMAL_OUT% echo Done

%NORMAL_OUT% %print_n% Parsing Version Manifest...
set "ps_parse_ver=powershell ^(Get-Content "%TEMP_DIR%\version_manifest.json""
set "ps_parse_ver=!ps_parse_ver! ^^| ConvertFrom-Json^^).latest.release"
for /f "delims=" %%A in ('!ps_parse_ver!') do set "VERSION_LATEST=%%A"
set "VERSION_TARGET=%VERSION_LATEST%"
%NORMAL_OUT% %print_n% Latest Version: [%VERSION_LATEST%]...
if defined FLAG_VERSION (
	set "VERSION_TARGET=%FLAG_VERSION%"
	%NORMAL_OUT% %print_n% Target Version: [!VERSION_TARGET!]...
)
set "PACKAGE_MANIFEST="
set "ps_pkg_manifest=powershell ^(^(Get-Content"
set "ps_pkg_manifest=!ps_pkg_manifest! "%TEMP_DIR%\version_manifest.json" ^^|"
set "ps_pkg_manifest=!ps_pkg_manifest! ConvertFrom-Json^^).versions ^^|"
set "ps_pkg_manifest=!ps_pkg_manifest! where-object id -eq "!VERSION_TARGET!"^^).url"
for /f "delims=" %%A in ('!ps_pkg_manifest!') do set "PACKAGE_MANIFEST=%%A"
%NORMAL_OUT% echo Done
if not defined PACKAGE_MANIFEST (
	%ERROR_OUT% echo Could not find target version !VERSION_TARGET!. Double-check the version manifest.
	exit /b 1
)

%NORMAL_OUT% %print_n% Downloading Package Manifest [!PACKAGE_MANIFEST!]...
curl -k -s !PACKAGE_MANIFEST! -o "%TEMP_DIR%\pkg_manifest.json"
if not exist "%TEMP_DIR%\pkg_manifest.json" (
	%ERROR_OUT% echo Download error. Exiting.
	exit /b 1
)
%NORMAL_OUT% echo Done

%NORMAL_OUT% %print_n% Parsing Package Manifest...
set "ps_parse_manifest=powershell ^(Get-Content "%TEMP_DIR%\pkg_manifest.json""
set "ps_parse_manifest=!ps_parse_manifest! ^^| ConvertFrom-Json^^)"
set "ps_parse_manifest=!ps_parse_manifest!.downloads.server"
:: I have no idea why I need to declare variables for this
set "ps_url=!ps_parse_manifest!.url"
set "ps_sha1=!ps_parse_manifest!.sha1"
for /f "delims=" %%A in ('!ps_url!') do set "SERVER_NEWJAR_URL=%%A"
for /f "delims=" %%A in ('!ps_sha1!') do set "SERVER_NEWJAR_SHA1=%%A"
%NORMAL_OUT% echo Done

%NORMAL_OUT% %print_n% Old JAR SHA1: 
for /f "delims=" %%A in ('certutil -hashfile "%JAR_PATH%" SHA1 ^| find /v "hash"') do set "OLD_SHA1=%%A"
:: Probably isn't needed, but it's there for backwards compatibility
set "SERVER_OLDJAR_SHA1=%OLD_SHA1: =%"
%NORMAL_OUT% echo !SERVER_OLDJAR_SHA1!
%NORMAL_OUT% echo New JAR SHA1: !SERVER_NEWJAR_SHA1!

if "!SERVER_OLDJAR_SHA1!"=="!SERVER_NEWJAR_SHA1!" (
	%NORMAL_OUT% echo SHA1 sums match. %JAR_PATH% is already target version.
	if defined FLAG_TEST exit /b
	
	if not defined FLAG_FORCE (
		%NORMAL_OUT% echo Exiting.
		exit /b
	) else (
		%NORMAL_OUT% echo Forcing JAR update.
	)
) else (
	%NORMAL_OUT% echo SHA1 sums mismatched. %JAR_PATH% differs from target version.
	if defined FLAG_TEST exit /b
	if not defined FLAG_CONFIRM (
		choice /M "Replace %JAR_PATH% with latest"
		if "!errorlevel!"=="2"  exit /b
	)
)

%NORMAL_OUT% %print_n% Downloading new server.jar from !SERVER_NEWJAR_URL!...
curl -k -s -L -f !SERVER_NEWJAR_URL! -o "%DOWNLOADED_JAR%"
if not exist "%DOWNLOADED_JAR%" (
	%ERROR_OUT% echo Download error. Exiting.
	exit /b 1
)
%NORMAL_OUT% echo Done

%NORMAL_OUT% %print_n% Downloaded JAR SHA1: 
for /f "delims=" %%A in ('certutil -hashfile "%DOWNLOADED_JAR%" SHA1 ^| find /v "hash"') do set "DL_SHA1=%%A"
set "SERVER_DLJAR_SHA1=%DL_SHA1: =%"
%NORMAL_OUT% echo %SERVER_DLJAR_SHA1%

if "!SERVER_DLJAR_SHA1!"=="!SERVER_NEWJAR_SHA1!" (
	%NORMAL_OUT% echo SHA1 sums match
) else (
	%ERROR_OUT% echo SHA1 sums do not match. Exiting.
	exit /b 1
)

set "JAR_PATH_BACKUP=%JAR_PATH%.bak"
%NORMAL_OUT% %print_n% Backing up server.jar...
>nul move /Y "%JAR_PATH%" "%JAR_PATH_BACKUP%"
%NORMAL_OUT% echo Done

%NORMAL_OUT% %print_n% Copying downloaded file into place...
copy /V /Y "%DOWNLOADED_JAR%" "%JAR_PATH%" >nul
if not "!errorlevel!"=="0" (
	%ERROR_OUT% echo FAILURE. Rolling back.
	>nul move /Y "%JAR_PATH_BACKUP%" "%JAR_PATH%"
	exit /b 1
) else (
	%NORMAL_OUT% echo Done
)

exit /b

::------------------------------------------------------------------------------
:: Displays the help page for the script
::
:: Arguments: None
:: Returns:   None
::------------------------------------------------------------------------------
:usage
echo %~nx0 - Updates the minecraft server jar file
echo A port of updatemcjar.sh by Andrew Haskell
echo(
echo USAGE: %~nx0 [options]
echo    -f, --force      If the Target Version SHA1 matches the current
echo                     file's SHA1, force the update anyway, implies --yes
echo    -h, --help       Print this help message
echo    --jar-path       Specify a different final JAR path, default is
echo                     %JAR_PATH%
echo    --manifest       Specify a different version manifest URL, default
echo                     is %VERSION_MANIFEST%
echo    --no-err         Suppress error messages (Dangerous!)
echo    -s, --silent     Suppress script output, implies --yes
echo    -t, --test       Test the Target Version SHA1 against the current
echo                     file's SHA1 without changing any files
echo    --temp-dir       Specify a different temporary directory,
echo                     default is %TEMP_DIR%
echo    -v, --version    Specify a different target version; without this
echo                     parameter, the latest release version is used
echo    -y, --yes        Skip update confirmationecho
exit /b