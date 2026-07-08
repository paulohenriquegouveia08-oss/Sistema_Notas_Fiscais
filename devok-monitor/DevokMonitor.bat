@echo off
chcp 65001 >nul 2>&1
title Devok Monitor — Instalador

echo.
echo ============================================
echo   Devok Monitor — Instalador Automatico
echo ============================================
echo.

:: Verificar se Python esta instalado
echo [1/4] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado. Baixando Python 3.12...
    
    :: Criar pasta temporaria
    if not exist "%TEMP%\devok-install" mkdir "%TEMP%\devok-install"
    
    :: Baixar Python
    echo Baixando instalador...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe' -OutFile '%TEMP%\devok-install\python-installer.exe'"
    
    if not exist "%TEMP%\devok-install\python-installer.exe" (
        echo ERRO: Nao foi possivel baixar o Python.
        echo Baixe manualmente em: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    
    echo Instalando Python (pode demorar 1-2 minutos)...
    "%TEMP%\devok-install\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
    
    :: Atualizar PATH nesta sessao
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
    
    echo Python instalado com sucesso!
    echo.
) else (
    echo Python encontrado!
    python --version
)
echo.

:: Verificar pip
echo [2/4] Verificando pip...
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando pip...
    python -m ensurepip --upgrade
)
echo pip OK!
echo.

:: Instalar dependencias
echo [3/4] Instalando dependencias...
if not exist "%~dp0venv" (
    python -m venv "%~dp0venv"
)
call "%~dp0venv\Scripts\activate.bat"
pip install requests --quiet
echo Dependencias instaladas!
echo.

:: Copiar script principal se nao existir
echo [4/4] Preparando aplicativo...
if not exist "%~dp0devok_monitor.py" (
    echo ERRO: Arquivo devok_monitor.py nao encontrado na pasta.
    echo Certifique-se de que todos os arquivos estao na mesma pasta.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Instalacao concluida! Iniciando app...
echo ============================================
echo.

:: Rodar o app
"%~dp0venv\Scripts\python.exe" "%~dp0devok_monitor.py"

:: Limpar
deactivate 2>nul
