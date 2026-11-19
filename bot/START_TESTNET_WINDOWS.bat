@echo off
setlocal
cd /d "%~dp0.."
where py >nul 2>nul
if %errorlevel%==0 (set "PY=py -3") else (set "PY=python")
if not exist "bot\.env" (
  copy "bot\.env.example" "bot\.env" >nul
  echo.
  echo CONFIGURATION REQUISE : bot\.env cree.
  echo Renseignez uniquement l'adresse publique et une cle API Wallet TESTNET.
  echo N'utilisez JAMAIS votre phrase de recuperation.
  notepad "bot\.env"
  echo.
  echo Relancez ce fichier apres configuration.
  pause
  exit /b 0
)
if not exist "bot\.venv\Scripts\python.exe" (
  %PY% -m venv "bot\.venv"
  if errorlevel 1 (echo Python 3.11+ requis & pause & exit /b 1)
)
"bot\.venv\Scripts\python.exe" -m pip install -r "bot\requirements.txt"
if errorlevel 1 (echo Installation impossible & pause & exit /b 1)
echo.
echo 1 - Lecture seule / verification (aucun ordre)
echo 2 - Autoriser un seul achat limite TESTNET apres confirmation
choice /c 12 /n /m "Votre choix [1/2] : "
if errorlevel 2 (
  "bot\.venv\Scripts\python.exe" "bot\grid_bot.py" --execute
) else (
  "bot\.venv\Scripts\python.exe" "bot\grid_bot.py"
)
echo.
pause
