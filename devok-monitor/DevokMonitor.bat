@echo off
chcp 65001 >nul 2>&1
title Devok Monitor

:: Criar pasta do app
set "APPDIR=%USERPROFILE%\DevokMonitor"
if not exist "%APPDIR%" mkdir "%APPDIR%"

echo.
echo ============================================
echo   Devok Monitor — Instalando...
echo ============================================
echo.

:: Verificar Python
echo [1/3] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao encontrado. Baixando...
    if not exist "%TEMP%\devok-install" mkdir "%TEMP%\devok-install"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe' -OutFile '%TEMP%\devok-install\python-installer.exe'"
    if not exist "%TEMP%\devok-install\python-installer.exe" (
        echo ERRO: Nao baixou. Acesse https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo Instalando Python...
    "%TEMP%\devok-install\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
    timeout /t 5 /nobreak >nul
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
)
echo Python OK!
python --version
echo.

:: Instalar dependencias
echo [2/3] Configurando...
pip install requests --quiet 2>nul
echo OK!
echo.

:: Criar script Python
echo [3/3] Preparando app...
echo.

(
echo import os, sys, json, time, threading, tkinter as tk
echo from tkinter import filedialog, ttk
echo from datetime import datetime
echo import urllib.request, urllib.error
echo.
echo CONFIG = os.path.join(os.path.dirname^(os.path.abspath^(__file__^)^), 'config.json'^)
echo DEFAULT = {"watchFolder":"", "apiUrl":"http://137.131.233.254:3002/api/v1", "scheduleTime":"18:00", "monitoring":False}
echo.
echo class App:
echo     def __init__(self^):
echo         self.root = tk.Tk^(^)
echo         self.root.title^("Devok Monitor — SisFin"^)
echo         self.root.geometry^("600x520"^)
echo         self.cfg = self.load^(^)
echo         self.monitoring = False
echo         self.sent = set^(^)
echo         self.stats = {"imported":0,"duplicated":0,"errors":0}
echo         self.build^(^)
echo         self.root.protocol^("WM_DELETE_WINDOW", self.close^)
echo.
echo     def load^(self^):
echo         try:
echo             if os.path.exists^(CONFIG^): return json.load^(open^(CONFIG^)^)
echo         except: pass
echo         return DEFAULT.copy^(^)
echo.
echo     def save^(self^):
echo         self.cfg["watchFolder"]=self.fv.get^(^)
echo         self.cfg["apiUrl"]=self.av.get^(^)
echo         json.dump^(self.cfg, open^(CONFIG,'w'^)^)
echo.
echo     def build^(self^):
echo         m = ttk.Frame^(self.root, padding=10^)
echo         m.pack^(fill=tk.BOTH, expand=True^)
echo         ttk.Label^(m, text="Devok Monitor", font=('Segoe UI',14,'bold'^)^).pack^(pady=(0,10^)^)
echo         f1=ttk.Frame^(m^); f1.pack^(fill=tk.X, pady=2^)
echo         ttk.Label^(f1, text="Pasta:", width=10^).pack^(side=tk.LEFT^)
echo         self.fv=tk.StringVar^(value=self.cfg.get^("watchFolder",""^)^)
echo         ttk.Entry^(f1, textvariable=self.fv, width=42^).pack^(side=tk.LEFT, padx=5^)
echo         ttk.Button^(f1, text="Procurar", command=self.browse^).pack^(side=tk.LEFT^)
echo         f2=ttk.Frame^(m^); f2.pack^(fill=tk.X, pady=2^)
echo         ttk.Label^(f2, text="API:", width=10^).pack^(side=tk.LEFT^)
echo         self.av=tk.StringVar^(value=self.cfg.get^("apiUrl",DEFAULT["apiUrl"]^)^)
echo         ttk.Entry^(f2, textvariable=self.av, width=42^).pack^(side=tk.LEFT, padx=5^)
echo         bf=ttk.Frame^(m^); bf.pack^(fill=tk.X, pady=10^)
echo         self.bs=ttk.Button^(bf, text="Iniciar", command=self.start^)
echo         self.bs.pack^(side=tk.LEFT, padx=5^)
echo         self.bp=ttk.Button^(bf, text="Parar", command=self.stop, state=tk.DISABLED^)
echo         self.bp.pack^(side=tk.LEFT, padx=5^)
echo         ttk.Button^(bf, text="Verificar Agora", command=self.check_now^).pack^(side=tk.LEFT, padx=5^)
echo         sf=ttk.Frame^(m^); sf.pack^(fill=tk.X, pady=2^)
echo         self.sv=tk.StringVar^(value="Parado"^)
echo         self.sl=ttk.Label^(sf, textvariable=self.sv^)
echo         self.sl.pack^(side=tk.LEFT^)
echo         ttk.Label^(m, text="Log:", font=('Segoe UI',9,'bold'^)^).pack^(anchor=tk.W, pady=(5,0^)^)
echo         lf=ttk.Frame^(m^); lf.pack^(fill=tk.BOTH, expand=True^)
echo         self.lt=tk.Text^(lf, height=12, font=('Consolas',9^), state=tk.DISABLED, bg='#1e1e1e', fg='#d4d4d4'^)
echo         sb=ttk.Scrollbar^(lf, command=self.lt.yview^)
echo         self.lt.configure^(yscrollcommand=sb.set^)
echo         self.lt.pack^(side=tk.LEFT, fill=tk.BOTH, expand=True^)
echo         sb.pack^(side=tk.RIGHT, fill=tk.Y^)
echo         self.stv=tk.StringVar^(value="Importados: 0"^)
echo         ttk.Label^(m, textvariable=self.stv^).pack^(anchor=tk.W, pady=(5,0^)^)
echo.
echo     def browse^(self^):
echo         f=filedialog.askdirectory^(^)
echo         if f: self.fv.set^(f^)
echo.
echo     def log^(self, msg^):
echo         ts=datetime.now^(^).strftime^("%H:%M:%S"^)
echo         self.lt.configure^(state=tk.NORMAL^)
echo         self.lt.insert^(tk.END, f"[{ts}] {msg}\n"^)
echo         self.lt.see^(tk.END^)
echo         self.lt.configure^(state=tk.DISABLED^)
echo.
echo     def send^(self, fp^):
echo         fn=os.path.basename^(fp^)
echo         with open^(fp,'rb'^) as f: fd=f.read^(^)
echo         b='----FB'+str^(int^(time.time^(^)^)^)
echo         body=(f'--{b}\r\nContent-Disposition: form-data; name="files"; filename="{fn}"\r\nContent-Type: application/xml\r\n\r\n'.encode^('utf-8'^)+fd+f'\r\n--{b}--\r\n'.encode^('utf-8'^)^)
echo         req=urllib.request.Request^(f"{self.av.get^(^).strip^(^)}/xml/import", data=body, headers={'Content-Type':f'multipart/form-data; boundary={b}'}, method='POST'^)
echo         with urllib.request.urlopen^(req, timeout=60^) as r: return json.loads^(r.read^(^).decode^('utf-8'^)^)
echo.
echo     def mv^(self, s, d^):
echo         os.makedirs^(d, exist_ok=True^)
echo         t=os.path.join^(d, os.path.basename^(s^)^)
echo         if os.path.exists^(t^): n,e=os.path.splitext^(os.path.basename^(s^)^); t=os.path.join^(d, f"{n}_{int^(time.time^(^)^)}{e}"^)
echo         os.rename^(s, t^)
echo.
echo     def check^(self^):
echo         folder=self.fv.get^(^).strip^(^)
echo         if not folder or not os.path.isdir^(folder^): self.log^("Pasta invalida"^); return
echo         xmls=[f for f in os.listdir^(folder^) if f.lower^(^).endswith^('.xml'^) and os.path.isfile^(os.path.join^(folder,f^)^)]
echo         if not self.sent: 
echo             pass
echo         if not xmls: self.log^("Nenhum XML novo"^); return
echo         self.log^(f"{len^(xmls^)} XML(s) encontrado(s)"^)
echo         for fn in xmls:
echo             fp=os.path.join^(folder,fn^)
echo             if fn in self.sent: continue
echo             try:
echo                 self.log^(f"Enviando: {fn}"^)
echo                 r=self.send^(fp^)
echo                 if r.get^('imported',0^)>0: self.log^(f"OK {fn}"^); self.mv^(fp,os.path.join^(folder,'processados'^)^); self.stats["imported"]+=1
echo                 elif r.get^('duplicated',0^)>0: self.log^(f"SKIP {fn}"^); self.mv^(fp,os.path.join^(folder,'processados'^)^); self.stats["duplicated"]+=1
echo                 else: self.log^(f"ERRO {fn}"^); self.mv^(fp,os.path.join^(folder,'erros'^)^); self.stats["errors"]+=1
echo                 self.sent.add^(fn^)
echo                 self.stv.set^(f"Importados: {self.stats['imported']} | Dup: {self.stats['duplicated']} | Erros: {self.stats['errors']}"^)
echo                 time.sleep^(1^)
echo             except Exception as e: self.log^(f"ERRO {fn}: {e}"^); self.stats["errors"]+=1
echo.
echo     def loop^(self^):
echo         while self.monitoring: self.log^("Verificando..."^); self.check^(^); [time.sleep^(1^) for _ in range^(30^) if self.monitoring]
echo.
echo     def start^(self^):
echo         if not self.fv.get^(^).strip^(^): self.log^("Selecione a pasta"^); return
echo         if not os.path.isdir^(self.fv.get^(^).strip^(^)^): self.log^("Pasta nao existe"^); return
echo         self.monitoring=True; self.save^(^); self.sv.set^("Rodando"^)
echo         self.bs.configure^(state=tk.DISABLED^); self.bp.configure^(state=tk.NORMAL^)
echo         self.log^("Monitoramento iniciado"^)
echo         threading.Thread^(target=self.loop, daemon=True^).start^(^)
echo.
echo     def stop^(self^):
echo         self.monitoring=False; self.save^(^); self.sv.set^("Parado"^)
echo         self.bs.configure^(state=tk.NORMAL^); self.bp.configure^(state=tk.DISABLED^)
echo         self.log^("Parado"^)
echo.
echo     def check_now^(self^):
echo         if not self.fv.get^(^).strip^(^): self.log^("Selecione a pasta"^); return
echo         threading.Thread^(target=self.check, daemon=True^).start^(^)
echo.
echo     def close^(self^): self.monitoring=False; self.save^(^); self.root.destroy^(^)
echo     def run^(self^): self.root.mainloop^(^)
echo.
echo if __name__=='__main__': App^(^).run^(^)
) > "%APPDIR%\devok_monitor.py"

echo App criado em: %APPDIR%
echo.

:: Abrir app
echo Abrindo Devok Monitor...
start "" python "%APPDIR%\devok_monitor.py"
