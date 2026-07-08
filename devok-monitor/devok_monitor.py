import os
import sys
import json
import time
import threading
import tkinter as tk
from tkinter import filedialog, ttk
from datetime import datetime
import urllib.request
import urllib.error

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

DEFAULT_CONFIG = {
    "watchFolder": "",
    "apiUrl": "http://137.131.233.254:3002/api/v1",
    "scheduleTime": "18:00",
    "monitoring": False,
}


class DevokMonitor:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Devok Monitor — SisFin Importer")
        self.root.geometry("620x550")
        self.root.resizable(False, False)

        self.config = self.load_config()
        self.monitoring = False
        self.monitor_thread = None
        self.sent_files = set()
        self.stats = {"imported": 0, "duplicated": 0, "errors": 0}
        self.last_check = None

        self.build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def load_config(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return DEFAULT_CONFIG.copy()

    def save_config(self):
        self.config["watchFolder"] = self.folder_var.get()
        self.config["apiUrl"] = self.api_var.get()
        self.config["scheduleTime"] = self.schedule_var.get()
        self.config["monitoring"] = self.monitoring
        with open(CONFIG_FILE, 'w') as f:
            json.dump(self.config, f, indent=2)

    def build_ui(self):
        style = ttk.Style()
        style.configure('Title.TLabel', font=('Segoe UI', 14, 'bold'))
        style.configure('Status.TLabel', font=('Segoe UI', 10))
        style.configure('Green.TLabel', font=('Segoe UI', 10), foreground='green')
        style.configure('Red.TLabel', font=('Segoe UI', 10), foreground='red')

        main = ttk.Frame(self.root, padding=10)
        main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main, text="Devok Monitor — SisFin Importer", style='Title.TLabel').pack(pady=(0, 10))

        # Folder
        f1 = ttk.Frame(main)
        f1.pack(fill=tk.X, pady=2)
        ttk.Label(f1, text="Pasta Devok:", width=14).pack(side=tk.LEFT)
        self.folder_var = tk.StringVar(value=self.config.get("watchFolder", ""))
        ttk.Entry(f1, textvariable=self.folder_var, width=38).pack(side=tk.LEFT, padx=5)
        ttk.Button(f1, text="Procurar", command=self.browse_folder).pack(side=tk.LEFT)

        # API
        f2 = ttk.Frame(main)
        f2.pack(fill=tk.X, pady=2)
        ttk.Label(f2, text="API SisFin:", width=14).pack(side=tk.LEFT)
        self.api_var = tk.StringVar(value=self.config.get("apiUrl", DEFAULT_CONFIG["apiUrl"]))
        ttk.Entry(f2, textvariable=self.api_var, width=38).pack(side=tk.LEFT, padx=5)

        # Schedule
        f3 = ttk.Frame(main)
        f3.pack(fill=tk.X, pady=2)
        ttk.Label(f3, text="Horario:", width=14).pack(side=tk.LEFT)
        self.schedule_var = tk.StringVar(value=self.config.get("scheduleTime", "18:00"))
        ttk.Entry(f3, textvariable=self.schedule_var, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Label(f3, text="(verificacao diaria)").pack(side=tk.LEFT)

        # Buttons
        bf = ttk.Frame(main)
        bf.pack(fill=tk.X, pady=10)
        self.btn_start = ttk.Button(bf, text="Iniciar Monitoramento", command=self.start_monitoring)
        self.btn_start.pack(side=tk.LEFT, padx=5)
        self.btn_stop = ttk.Button(bf, text="Parar", command=self.stop_monitoring, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT, padx=5)
        self.btn_check = ttk.Button(bf, text="Verificar Agora", command=self.check_now)
        self.btn_check.pack(side=tk.LEFT, padx=5)

        # Status
        sf = ttk.Frame(main)
        sf.pack(fill=tk.X, pady=2)
        self.status_var = tk.StringVar(value="Parado")
        self.status_lbl = ttk.Label(sf, textvariable=self.status_var, style='Red.TLabel')
        self.status_lbl.pack(side=tk.LEFT)

        self.last_check_var = tk.StringVar(value="Ultima verificacao: —")
        ttk.Label(sf, textvariable=self.last_check_var, font=('Segoe UI', 9)).pack(side=tk.LEFT, padx=20)

        # Log
        ttk.Label(main, text="Log:", font=('Segoe UI', 9, 'bold')).pack(anchor=tk.W, pady=(5, 0))
        lf = ttk.Frame(main)
        lf.pack(fill=tk.BOTH, expand=True)
        self.log_text = tk.Text(lf, height=12, font=('Consolas', 9), state=tk.DISABLED, bg='#1e1e1e', fg='#d4d4d4')
        sb = ttk.Scrollbar(lf, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=sb.set)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)

        # Stats
        self.stats_var = tk.StringVar(value="Importados: 0 | Duplicados: 0 | Erros: 0")
        ttk.Label(main, textvariable=self.stats_var, font=('Segoe UI', 9)).pack(anchor=tk.W, pady=(5, 0))

    def browse_folder(self):
        folder = filedialog.askdirectory(title="Selecionar pasta do Devok")
        if folder:
            self.folder_var.set(folder)

    def log(self, msg):
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"[{ts}] {msg}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def update_stats(self):
        self.stats_var.set(
            f"Importados: {self.stats['imported']} | "
            f"Duplicados: {self.stats['duplicated']} | "
            f"Erros: {self.stats['errors']}"
        )

    def send_xml(self, file_path):
        file_name = os.path.basename(file_path)
        api_url = self.api_var.get().strip()

        with open(file_path, 'rb') as f:
            file_data = f.read()

        boundary = '----FormBoundary' + str(int(time.time()))
        body = (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="files"; filename="{file_name}"\r\n'
            f'Content-Type: application/xml\r\n\r\n'
        ).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

        req = urllib.request.Request(
            f"{api_url}/xml/import",
            data=body,
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
            method='POST',
        )

        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))

    def move_file(self, src, dest_folder):
        os.makedirs(dest_folder, exist_ok=True)
        dest = os.path.join(dest_folder, os.path.basename(src))
        if os.path.exists(dest):
            name, ext = os.path.splitext(os.path.basename(src))
            dest = os.path.join(dest_folder, f"{name}_{int(time.time())}{ext}")
        os.rename(src, dest)

    def check_folder(self):
        folder = self.folder_var.get().strip()
        if not folder or not os.path.isdir(folder):
            self.log("Pasta nao configurada ou nao encontrada")
            return

        xml_files = [f for f in os.listdir(folder) if f.lower().endswith('.xml') and os.path.isfile(os.path.join(folder, f))]

        if not xml_files:
            self.log("Nenhum XML novo encontrado")
            return

        self.log(f"{len(xml_files)} XML(s) encontrado(s)")

        for file_name in xml_files:
            file_path = os.path.join(folder, file_name)
            if file_name in self.sent_files:
                continue

            try:
                self.log(f"Enviando: {file_name}")
                result = self.send_xml(file_path)

                imported = result.get('imported', 0)
                duplicated = result.get('duplicated', 0)
                errors = result.get('errors', 0)

                if imported > 0:
                    detail = result.get('details', [{}])[0]
                    acao = detail.get('acao', 'nota_criada')
                    self.log(f"OK {file_name} -> {acao}")
                    self.move_file(file_path, os.path.join(folder, 'processados'))
                    self.stats["imported"] += 1
                elif duplicated > 0:
                    self.log(f"SKIP {file_name} -> Duplicado")
                    self.move_file(file_path, os.path.join(folder, 'processados'))
                    self.stats["duplicated"] += 1
                elif errors > 0:
                    err = result.get('details', [{}])[0].get('errors', ['Erro'])[0]
                    self.log(f"ERRO {file_name} -> {err}")
                    self.move_file(file_path, os.path.join(folder, 'erros'))
                    self.stats["errors"] += 1
                else:
                    self.log(f"OK {file_name} -> Processado")
                    self.move_file(file_path, os.path.join(folder, 'processados'))

                self.sent_files.add(file_name)
                self.update_stats()
                time.sleep(1)

            except Exception as e:
                self.log(f"ERRO {file_name} -> {e}")
                self.stats["errors"] += 1
                self.update_stats()

        self.last_check = datetime.now()
        self.last_check_var.set(f"Ultima verificacao: {self.last_check.strftime('%H:%M:%S')}")

    def monitor_loop(self):
        while self.monitoring:
            self.log("Verificando pasta...")
            self.check_folder()
            for _ in range(30):
                if not self.monitoring:
                    break
                time.sleep(1)

    def start_monitoring(self):
        folder = self.folder_var.get().strip()
        if not folder:
            self.log("Selecione a pasta do Devok primeiro")
            return
        if not os.path.isdir(folder):
            self.log(f"Pasta nao encontrada: {folder}")
            return

        self.monitoring = True
        self.save_config()
        self.status_var.set("Rodando")
        self.status_lbl.configure(style='Green.TLabel')
        self.btn_start.configure(state=tk.DISABLED)
        self.btn_stop.configure(state=tk.NORMAL)
        self.log("Monitoramento iniciado")

        self.monitor_thread = threading.Thread(target=self.monitor_loop, daemon=True)
        self.monitor_thread.start()

    def stop_monitoring(self):
        self.monitoring = False
        self.save_config()
        self.status_var.set("Parado")
        self.status_lbl.configure(style='Red.TLabel')
        self.btn_start.configure(state=tk.NORMAL)
        self.btn_stop.configure(state=tk.DISABLED)
        self.log("Monitoramento parado")

    def check_now(self):
        folder = self.folder_var.get().strip()
        if not folder:
            self.log("Selecione a pasta do Devok primeiro")
            return
        self.log("Verificacao manual...")
        threading.Thread(target=self.check_folder, daemon=True).start()

    def on_close(self):
        self.monitoring = False
        self.save_config()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


if __name__ == '__main__':
    app = DevokMonitor()
    app.run()
