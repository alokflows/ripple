@echo off
REM Yap desktop agent (Windows) - double-click this file to start.
REM Text you send from your phone will paste wherever your cursor is.
cd /d "%~dp0"

if not exist .venv (
  echo First run - setting things up ^(takes a moment^)...
  python -m venv .venv
  call .venv\Scripts\pip install -q -r requirements.txt
)

echo ----------------------------------------------
echo  Yap - phone to your cursor
echo  Enter the SAME pairing code shown in the phone app.
echo ----------------------------------------------
.venv\Scripts\python agent.py %*
pause
