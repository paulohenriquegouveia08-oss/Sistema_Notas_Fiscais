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
    echo Python NAO encontrado. Instalando automaticamente...
    echo.
    
    :: Criar pasta temporaria
    if not exist "%TEMP%\devok-install" mkdir "%TEMP%\devok-install"
    
    :: Baixar Python 3.12 (versao estavel)
    echo Baixando Python 3.12...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe' -OutFile '%TEMP%\devok-install\python-installer.exe'"
    
    if not exist "%TEMP%\devok-install\python-installer.exe" (
        echo.
        echo ERRO: Nao foi possivel baixar o Python.
        echo Acesse: https://www.python.org/downloads/
        echo Instale o Python e marque "Add Python to PATH"
        echo Depois rode este .bat novamente.
        pause
        exit /b 1
    )
    
    echo Instalando Python (1-2 minutos)...
    "%TEMP%\devok-install\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
    timeout /t 5 /nobreak >nul
    
    :: Atualizar PATH
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
    
    echo Python instalado!
    python --version
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
    python -m ensurepip --upgrade >nul 2>&1
)
echo pip OK!
echo.

:: Instalar dependencias
echo [3/4] Instalando dependencias...
pip install requests --quiet 2>nul
echo Dependencias OK!
echo.

:: Verificar arquivos
echo [4/4] Verificando arquivos...
if not exist "%~dp0devok_monitor.py" (
    echo.
    echo ERRO: Arquivo devok_monitor.py nao encontrado!
    echo Baixe todos os arquivos e coloque na mesma pasta.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Instalacao concluida!
echo ============================================
echo.

:: Rodar o app
python "%~dp0devok_monitor.py"
