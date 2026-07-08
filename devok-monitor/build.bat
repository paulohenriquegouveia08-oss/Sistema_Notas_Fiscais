@echo off
echo ====================================
echo  Devok Monitor — Gerando .exe
echo ====================================

pip install pyinstaller

pyinstaller --onefile --windowed --name "DevokMonitor" main.py

echo.
echo ====================================
echo  .exe gerado em: dist\DevokMonitor.exe
echo ====================================
pause
