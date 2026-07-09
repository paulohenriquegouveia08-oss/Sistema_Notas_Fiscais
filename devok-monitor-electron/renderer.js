const folderInput = document.getElementById('folderPath');
const apiInput = document.getElementById('apiUrl');
const scheduleInput = document.getElementById('scheduleTime');
const btnBrowse = document.getElementById('btnBrowse');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnCheck = document.getElementById('btnCheck');
const statusText = document.getElementById('statusText');
const lastCheckText = document.getElementById('lastCheckText');
const logBox = document.getElementById('logBox');
const statsText = document.getElementById('statsText');

let monitoring = false;

function addLog(msg) {
  const div = document.createElement('div');
  div.className = 'log-line';
  if (msg.includes('✅')) div.classList.add('log-ok');
  else if (msg.includes('⏭️')) div.classList.add('log-skip');
  else if (msg.includes('❌')) div.classList.add('log-err');
  else if (msg.includes('▶') || msg.includes('🔍') || msg.includes('⏰')) div.classList.add('log-info');
  div.textContent = msg;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

function setStatus(on) {
  monitoring = on;
  statusText.textContent = on ? '● Rodando' : '● Parado';
  statusText.className = on ? 'status-on' : 'status-off';
  btnStart.disabled = on;
  btnStop.disabled = !on;
}

function updateStats(stats) {
  statsText.textContent = `Importados: ${stats.imported} | Duplicados: ${stats.duplicated} | Erros: ${stats.errors}`;
}

// Event listeners
btnBrowse.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (folder) {
    folderInput.value = folder;
    saveCurrentConfig();
  }
});

btnStart.addEventListener('click', async () => {
  if (!folderInput.value) {
    addLog('❌ Selecione a pasta do Devok primeiro');
    return;
  }
  await saveCurrentConfig();
  await window.electronAPI.startMonitoring();
  setStatus(true);
});

btnStop.addEventListener('click', async () => {
  await window.electronAPI.stopMonitoring();
  setStatus(false);
});

btnCheck.addEventListener('click', async () => {
  if (!folderInput.value) {
    addLog('❌ Selecione a pasta do Devok primeiro');
    return;
  }
  await saveCurrentConfig();
  addLog('🔍 Verificação manual...');
  await window.electronAPI.checkNow();
});

apiInput.addEventListener('change', saveCurrentConfig);
scheduleInput.addEventListener('change', saveCurrentConfig);

async function saveCurrentConfig() {
  await window.electronAPI.saveConfig({
    watchFolder: folderInput.value,
    apiUrl: apiInput.value,
    scheduleTime: scheduleInput.value,
    monitoring,
  });
}

// IPC listeners
window.electronAPI.onLog((msg) => addLog(msg));
window.electronAPI.onStats((stats) => updateStats(stats));
window.electronAPI.onLastCheck((time) => {
  lastCheckText.textContent = `Última verificação: ${time}`;
});
window.electronAPI.onConfig((config) => {
  if (config.watchFolder) folderInput.value = config.watchFolder;
  if (config.apiUrl) apiInput.value = config.apiUrl;
  if (config.scheduleTime) scheduleInput.value = config.scheduleTime;
  if (config.monitoring) setStatus(true);
});

// Load config on start
window.electronAPI.getConfig().then((config) => {
  if (config.watchFolder) folderInput.value = config.watchFolder;
  if (config.apiUrl) apiInput.value = config.apiUrl;
  if (config.scheduleTime) scheduleInput.value = config.scheduleTime;
  if (config.monitoring) setStatus(true);
});
