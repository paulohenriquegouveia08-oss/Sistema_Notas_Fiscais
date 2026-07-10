const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const APP_VERSION = '1.8.0';
const VERSION_URL = 'http://137.131.233.254:3002/api/v1/devok-monitor/download/version.json';

let mainWindow;
let monitorInterval = null;
let scheduleTimeout = null;
let lastCheckTime = null;
let isChecking = false;

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

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

function log(message) {
  const ts = new Date().toLocaleTimeString('pt-BR');
  if (mainWindow) {
    mainWindow.webContents.send('log', `[${ts}] ${message}`);
  }
}

function httpRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    client.get({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Resposta inválida')); }
      });
    }).on('error', reject);
  });
}

function sendXmlBatch(filePaths, retries = 1) {
  return new Promise((resolve, reject) => {
    const config = loadConfig();
    const boundary = '----ElectronBoundary' + Date.now();
    const CRLF = '\r\n';
    const parts = [];

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const fileData = fs.readFileSync(filePath);
      parts.push(`--${boundary}${CRLF}`);
      parts.push(`Content-Disposition: form-data; name="files"; filename="${fileName}"${CRLF}`);
      parts.push(`Content-Type: application/xml${CRLF}${CRLF}`);
      parts.push(fileData);
      parts.push(CRLF);
    }
    parts.push(`--${boundary}--${CRLF}`);

    const body = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

    const url = new URL(`${config.apiUrl}/xml/import`);
    const client = url.protocol === 'https:' ? https : http;

    log(`📦 Enviando ${filePaths.length} XML(s) em lote...`);

    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 300000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('error', (err) => {
        if (retries > 0) {
          log(`⚠️ Erro na resposta, tentando novamente...`);
          setTimeout(() => sendXmlBatch(filePaths, retries - 1).then(resolve, reject), 3000);
        } else {
          reject(new Error(`Erro na resposta: ${err.message}`));
        }
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          if (retries > 0) {
            log(`⚠️ HTTP ${res.statusCode}, tentando novamente...`);
            setTimeout(() => sendXmlBatch(filePaths, retries - 1).then(resolve, reject), 3000);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch {
          if (retries > 0) {
            log(`⚠️ Resposta inválida (len ${data.length}), tentando novamente...`);
            setTimeout(() => sendXmlBatch(filePaths, retries - 1).then(resolve, reject), 3000);
          } else {
            reject(new Error(`Resposta inválida (status ${res.statusCode}, len ${data.length})`));
          }
        }
      });
    });

    req.on('error', (err) => {
      if (retries > 0) {
        log(`⚠️ Erro de conexão: ${err.message}, tentando novamente...`);
        setTimeout(() => sendXmlBatch(filePaths, retries - 1).then(resolve, reject), 3000);
      } else {
        reject(err);
      }
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function copyFile(src, destFolder) {
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
  let dest = path.join(destFolder, path.basename(src));
  if (fs.existsSync(dest)) {
    const ext = path.extname(src);
    const name = path.basename(src, ext);
    dest = path.join(destFolder, `${name}_${Date.now()}${ext}`);
  }
  fs.copyFileSync(src, dest);
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

function extractChaveAcesso(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/chaveNFe[^>]*>(\d{44})/);
    if (match) return match[1];
    const match2 = content.match(/Id="NFe(\d{44})"/);
    if (match2) return match2[1];
    return null;
  } catch {
    return null;
  }
}

function extractNumero(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/<nNF>(\d+)<\/nNF>/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function checkChaveExists(chave) {
  const config = loadConfig();
  try {
    const url = `${config.apiUrl}/invoices/check-chave/${chave}`;
    const result = await httpRequest(url);
    return result.exists === true;
  } catch {
    return false;
  }
}

async function checkFolder() {
  if (isChecking) {
    log('Verificação já em andamento...');
    return { imported: 0, duplicated: 0, errors: 0 };
  }
  isChecking = true;

  const config = loadConfig();
  const folder = config.watchFolder;
  if (!folder || !fs.existsSync(folder)) {
    log('Pasta não configurada ou não encontrada');
    isChecking = false;
    return { imported: 0, duplicated: 0, errors: 0 };
  }

  const files = fs.readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith('.xml') && fs.statSync(path.join(folder, f)).isFile());

  if (files.length === 0) {
    log('Nenhum XML na pasta');
    isChecking = false;
    return { imported: 0, duplicated: 0, errors: 0 };
  }

  log(`${files.length} XML(s) na pasta`);
  const stats = { imported: 0, duplicated: 0, errors: 0 };

  const validFiles = [];
  const invalidFiles = [];

  for (const file of files) {
    const filePath = path.join(folder, file);
    const validation = validateXml(filePath);
    if (!validation.valid) {
      log(`❌ ${file} → ${validation.error}`);
      copyFile(filePath, path.join(folder, 'erros'));
      stats.errors++;
      invalidFiles.push(file);
      continue;
    }

    const chave = extractChaveAcesso(filePath);
    if (!chave) {
      log(`❌ ${file} → Sem chave de acesso`);
      copyFile(filePath, path.join(folder, 'erros'));
      stats.errors++;
      continue;
    }

    const numero = extractNumero(filePath);
    validFiles.push({ filePath, file, chave, numero });
  }

  if (validFiles.length === 0) {
    log('Nenhum XML válido para enviar');
    if (mainWindow) mainWindow.webContents.send('stats', stats);
    isChecking = false;
    return stats;
  }

  log(`🔍 Verificando ${validFiles.length} chave(s) de acesso...`);
  const newFiles = [];

  for (const vf of validFiles) {
    const exists = await checkChaveExists(vf.chave);
    if (exists) {
      log(`⏭️ ${vf.file} → nota_existente (NF ${vf.numero || '?'})`);
      copyFile(vf.filePath, path.join(folder, 'duplicados'));
      stats.duplicated++;
    } else {
      newFiles.push(vf);
    }
  }

  if (mainWindow) mainWindow.webContents.send('stats', stats);

  if (newFiles.length === 0) {
    log('✅ Todos os XMLs já existem no banco');
    lastCheckTime = new Date();
    if (mainWindow) mainWindow.webContents.send('lastCheck', lastCheckTime.toLocaleTimeString('pt-BR'));
    isChecking = false;
    return stats;
  }

  log(`📤 ${newFiles.length} XML(s) novos para importar`);

  const batchFilePaths = newFiles.map(vf => vf.filePath);

  try {
    const result = await sendXmlBatch(batchFilePaths);

    if (result.details && Array.isArray(result.details)) {
      for (let i = 0; i < result.details.length; i++) {
        const detail = result.details[i];
        const vf = newFiles[i];
        if (!vf) continue;

        if (detail.invoice?.isNew) {
          log(`✅ ${vf.file} → ${detail.acao || 'nota_criada'}`);
          copyFile(vf.filePath, path.join(folder, 'processados'));
          stats.imported++;
        } else if (!detail.errors?.length) {
          log(`⏭️ ${vf.file} → ${detail.acao || 'duplicado'}`);
          copyFile(vf.filePath, path.join(folder, 'duplicados'));
          stats.duplicated++;
        } else {
          const err = detail.errors?.[0] || 'Erro';
          log(`❌ ${vf.file} → ${err}`);
          copyFile(vf.filePath, path.join(folder, 'erros'));
          stats.errors++;
        }
      }
    } else {
      log(`⚠️ Resposta inesperada da API`);
      for (const vf of newFiles) {
        copyFile(vf.filePath, path.join(folder, 'erros'));
        stats.errors++;
      }
    }
  } catch (e) {
    log(`❌ Erro no lote: ${e.message}`);
    for (const vf of newFiles) {
      copyFile(vf.filePath, path.join(folder, 'erros'));
      stats.errors++;
    }
  }

  if (mainWindow) mainWindow.webContents.send('stats', stats);

  lastCheckTime = new Date();
  if (mainWindow) mainWindow.webContents.send('lastCheck', lastCheckTime.toLocaleTimeString('pt-BR'));
  isChecking = false;
  return stats;
}

function startMonitoring() {
  if (monitorInterval) return;
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
  mainWindow.setTitle(`Devok Monitor v${APP_VERSION}`);

  mainWindow.on('close', () => {
    stopMonitoring();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  const config = loadConfig();
  if (config.monitoring) {
    startMonitoring();
    scheduleNext();
  }

  if (mainWindow) {
    mainWindow.webContents.send('config', config);
    mainWindow.webContents.send('version', APP_VERSION);
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
          message: `Nova versão: ${data.version}`,
          detail: data.changelog || 'Atualize para obter as últimas correções.',
          buttons: ['Baixar Atualização', 'Agora não'],
          defaultId: 0,
        });

        if (response.response === 0 && data.downloadUrl) {
          shell.openExternal(data.downloadUrl);
        }
      }
    }
  } catch {}
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
  await checkFolder();
  return true;
});

ipcMain.handle('reprocess', async () => {
  log('🔄 Reprocessando todos os XMLs da pasta...');
  await checkFolder();
  return true;
});
