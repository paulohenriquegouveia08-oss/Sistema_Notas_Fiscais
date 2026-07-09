const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const APP_VERSION = '1.0.0';
const VERSION_URL = 'http://137.131.233.254:3002/api/v1/devok-monitor/download/version.json';

let mainWindow;
let monitorInterval = null;
let scheduleTimeout = null;
let lastCheckTime = null;
let sentFiles = new Set();

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const SENT_PATH = path.join(app.getPath('userData'), 'sent.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return { watchFolder: '', apiUrl: 'http://137.131.233.254:3002/api/v1', scheduleTime: '18:00', monitoring: false };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function loadSent() {
  try {
    if (fs.existsSync(SENT_PATH)) {
      return new Set(JSON.parse(fs.readFileSync(SENT_PATH, 'utf-8')));
    }
  } catch {}
  return new Set();
}

function saveSent(sent) {
  fs.writeFileSync(SENT_PATH, JSON.stringify([...sent]));
}

function log(message) {
  const ts = new Date().toLocaleTimeString('pt-BR');
  if (mainWindow) {
    mainWindow.webContents.send('log', `[${ts}] ${message}`);
  }
}

function sendXml(filePath) {
  return new Promise((resolve, reject) => {
    const config = loadConfig();
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const boundary = '----ElectronBoundary' + Date.now();
    const CRLF = '\r\n';
    const parts = [];
    parts.push(`--${boundary}${CRLF}`);
    parts.push(`Content-Disposition: form-data; name="files"; filename="${fileName}"${CRLF}`);
    parts.push(`Content-Type: application/xml${CRLF}${CRLF}`);
    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    const body = Buffer.concat([header, fileData, footer]);

    const url = new URL(`${config.apiUrl}/xml/import`);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Resposta inválida')); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function moveFile(src, destFolder) {
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
  let dest = path.join(destFolder, path.basename(src));
  if (fs.existsSync(dest)) {
    const ext = path.extname(src);
    const name = path.basename(src, ext);
    dest = path.join(destFolder, `${name}_${Date.now()}${ext}`);
  }
  fs.renameSync(src, dest);
  return dest;
}

function validateXml(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('<nfeProc') && !content.includes('<NFe')) {
      return { valid: false, error: 'Não é XML de NF-e' };
    }
    if (!content.includes('infNFe') && !content.includes('chaveNFe')) {
      return { valid: false, error: 'XML inválido (sem infNFe)' };
    }
    if (content.trim().length < 100) {
      return { valid: false, error: 'XML muito pequeno' };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Erro ao ler: ${e.message}` };
  }
}

async function checkFolder() {
  const config = loadConfig();
  const folder = config.watchFolder;
  if (!folder || !fs.existsSync(folder)) {
    log('Pasta não configurada ou não encontrada');
    return { imported: 0, duplicated: 0, errors: 0 };
  }

  const files = fs.readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith('.xml') && fs.statSync(path.join(folder, f)).isFile());

  if (files.length === 0) {
    log('Nenhum XML novo encontrado');
    return { imported: 0, duplicated: 0, errors: 0 };
  }

  log(`${files.length} XML(s) encontrado(s)`);
  const stats = { imported: 0, duplicated: 0, errors: 0 };

  for (const file of files) {
    if (sentFiles.has(file)) continue;
    const filePath = path.join(folder, file);

    try {
      const validation = validateXml(filePath);
      if (!validation.valid) {
        log(`❌ ${file} → ${validation.error}`);
        moveFile(filePath, path.join(folder, 'erros'));
        stats.errors++;
        sentFiles.add(file);
        saveSent(sentFiles);
        continue;
      }

      log(`Enviando: ${file}`);
      const result = await sendXml(filePath);

      if (result.imported > 0) {
        const acao = result.details?.[0]?.acao || 'nota_criada';
        log(`✅ ${file} → ${acao}`);
        moveFile(filePath, path.join(folder, 'processados'));
        stats.imported++;
      } else if (result.duplicated > 0) {
        const acao = result.details?.[0]?.acao || 'duplicado';
        if (acao === 'nota_existente_xml_existente') {
          log(`⏭️ ${file} → Nota e XML já existem`);
        } else {
          log(`⏭️ ${file} → ${acao}`);
        }
        moveFile(filePath, path.join(folder, 'duplicados'));
        stats.duplicated++;
      } else if (result.errors > 0) {
        const err = result.details?.[0]?.errors?.[0] || 'Erro';
        log(`❌ ${file} → ${err}`);
        moveFile(filePath, path.join(folder, 'erros'));
        stats.errors++;
      } else {
        log(`⚠️ ${file} → Sem resultado`);
        moveFile(filePath, path.join(folder, 'erros'));
        stats.errors++;
      }

      sentFiles.add(file);
      saveSent(sentFiles);
      if (mainWindow) mainWindow.webContents.send('stats', stats);
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      log(`❌ ${file} → ${e.message}`);
      stats.errors++;
      if (mainWindow) mainWindow.webContents.send('stats', stats);
    }
  }

  lastCheckTime = new Date();
  if (mainWindow) mainWindow.webContents.send('lastCheck', lastCheckTime.toLocaleTimeString('pt-BR'));
  return stats;
}

function startMonitoring() {
  if (monitorInterval) return;
  sentFiles = loadSent();
  log('▶ Monitoramento iniciado');
  monitorInterval = setInterval(checkFolder, 30000);
  checkFolder();
}

function stopMonitoring() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  if (scheduleTimeout) { clearTimeout(scheduleTimeout); scheduleTimeout = null; }
  log('⏸ Monitoramento parado');
}

function scheduleNext() {
  const config = loadConfig();
  if (!config.scheduleTime) return;
  const [h, m] = config.scheduleTime.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - now.getTime();
  log(`Agendado para ${target.toLocaleTimeString('pt-BR')}`);
  scheduleTimeout = setTimeout(async () => {
    log('⏰ Horário agendado atingido');
    await checkFolder();
    scheduleNext();
  }, delay);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 620,
    height: 580,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', () => {
    stopMonitoring();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  sentFiles = loadSent();

  const config = loadConfig();
  if (config.monitoring) {
    startMonitoring();
    scheduleNext();
  }

  if (mainWindow) {
    mainWindow.webContents.send('config', config);
  }

  checkForUpdate();
});

async function checkForUpdate() {
  try {
    const url = new URL(VERSION_URL);
    const client = url.protocol === 'https:' ? https : http;

    const data = await new Promise((resolve, reject) => {
      client.get(url.href, { timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('Resposta inválida')); }
        });
      }).on('error', reject);
    });

    if (data.version && data.version !== APP_VERSION) {
      if (mainWindow) {
        const response = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Atualização disponível',
          message: `Nova versão disponível: ${data.version}`,
          detail: data.changelog || 'Atualize para obter as últimas correções.',
          buttons: ['Baixar Atualização', 'Agora não'],
          defaultId: 0,
        });

        if (response.response === 0 && data.downloadUrl) {
          shell.openExternal(data.downloadUrl);
        }
      }
    }
  } catch {
    // Silently ignore update check errors
  }
}

app.on('window-all-closed', () => {
  stopMonitoring();
  app.quit();
});

app.on('before-quit', () => {
  stopMonitoring();
});

// IPC handlers
ipcMain.handle('selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta do Devok',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('getConfig', () => loadConfig());

ipcMain.handle('saveConfig', (event, config) => {
  saveConfig(config);
  return true;
});

ipcMain.handle('startMonitoring', () => {
  const config = loadConfig();
  config.monitoring = true;
  saveConfig(config);
  startMonitoring();
  scheduleNext();
  return true;
});

ipcMain.handle('stopMonitoring', () => {
  const config = loadConfig();
  config.monitoring = false;
  saveConfig(config);
  stopMonitoring();
  return true;
});

ipcMain.handle('checkNow', async () => {
  sentFiles = loadSent();
  await checkFolder();
  return true;
});
