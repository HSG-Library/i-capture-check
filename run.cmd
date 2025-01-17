@echo off

:: Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"

:: Set the relative path to the Deno executable
set "DENO_EXE=deno\deno.exe"

:: Combine the script directory and relative Deno path
set "DENO_PATH=%SCRIPT_DIR%%DENO_EXE%"

:: Check if Deno executable exists
if not exist "%DENO_PATH%" (
    echo Error: Deno executable not found at %DENO_PATH%
    exit /b 1
)      

:: Run the Deno script, passing the dropped file path as an argument
"%DENO_PATH%" run --allow-import --allow-net --allow-read .\main.ts"

pause