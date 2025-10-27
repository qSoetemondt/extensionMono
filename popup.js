// Éléments DOM
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const monitoringToggle = document.getElementById('monitoringToggle');
const autoOpenCheckbox = document.getElementById('autoOpen');
const mutedCheckbox = document.getElementById('muted');
const autoMessagesCheckbox = document.getElementById('autoMessages');
const openLiveButton = document.getElementById('openLive');
const openOptionsButton = document.getElementById('openOptions');
const authStatus = document.getElementById('authStatus');
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  await loadSettings();
  await checkAuthStatus();
  setupEventListeners();
});

// Détecter l'API du navigateur
function getBrowserAPI() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  throw new Error('Extension API not available');
}

// Charger le statut actuel
async function loadStatus() {
  try {
    const browserAPI = getBrowserAPI();
    const response = await browserAPI.runtime.sendMessage({ action: 'checkStatus' });
    
    // Vérifier que response existe
    if (response && typeof response.isLive !== 'undefined') {
      updateStatus(response.isLive);
    } else {
      updateStatus(false);
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du statut:', error);
    updateStatus(false, true);
  }
}

// Mettre à jour l'affichage du statut
function updateStatus(live, error = false) {
  if (error) {
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Erreur de connexion';
  } else if (live) {
    statusDot.className = 'status-dot live';
    statusText.textContent = 'En direct';
  } else {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Hors ligne';
  }
}

// Charger les paramètres
async function loadSettings() {
  try {
    const browserAPI = getBrowserAPI();
    const result = await browserAPI.storage.local.get(['autoOpen', 'muted', 'autoMessages']);
    
    // Vérifier que result existe
    if (result) {
      autoOpenCheckbox.checked = result.autoOpen !== false;
      mutedCheckbox.checked = result.muted !== false;
      autoMessagesCheckbox.checked = result.autoMessages !== false;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  const browserAPI = getBrowserAPI();
  await browserAPI.storage.local.set({
    autoOpen: autoOpenCheckbox.checked,
    muted: mutedCheckbox.checked,
    autoMessages: autoMessagesCheckbox.checked
  });
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Toggle surveillance
  monitoringToggle.addEventListener('change', async (e) => {
    const browserAPI = getBrowserAPI();
    const action = e.target.checked ? 'startMonitoring' : 'stopMonitoring';
    await browserAPI.runtime.sendMessage({ action });
  });
  
  // Settings
  autoOpenCheckbox.addEventListener('change', saveSettings);
  mutedCheckbox.addEventListener('change', saveSettings);
  autoMessagesCheckbox.addEventListener('change', saveSettings);
  
  // Bouton ouvrir live
  openLiveButton.addEventListener('click', () => {
    const browserAPI = getBrowserAPI();
    browserAPI.tabs.create({ url: 'https://www.twitch.tv/monodie' });
    window.close();
  });
  
  // Bouton ouvrir options
  openOptionsButton.addEventListener('click', () => {
    const browserAPI = getBrowserAPI();
    browserAPI.runtime.openOptionsPage();
  });
  
  // Bouton authentification
  authBtn.addEventListener('click', () => {
    const browserAPI = getBrowserAPI();
    browserAPI.tabs.create({
      url: browserAPI.runtime.getURL('auth.html'),
      active: true
    });
  });
  
  // Bouton déconnexion
  logoutBtn.addEventListener('click', async () => {
    const browserAPI = getBrowserAPI();
    await browserAPI.storage.local.remove(['twitch_access_token', 'twitch_refresh_token']);
    await checkAuthStatus();
  });
}

// Vérifier l'authentification
async function checkAuthStatus() {
  try {
    const browserAPI = getBrowserAPI();
    const result = await browserAPI.storage.local.get(['twitch_access_token']);
    
    if (result.twitch_access_token) {
      authStatus.innerHTML = '<p style="color: green; font-size: 13px;">✅ Connecté à Twitch</p>';
      authBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
    } else {
      authStatus.innerHTML = '<p style="color: orange; font-size: 13px;">⚠️ Non connecté - Messages automatiques désactivés</p>';
      authBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur vérification auth:', error);
  }
}

// Écouter les changements de storage pour mettre à jour automatiquement
const browserAPI = getBrowserAPI();
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.twitch_access_token) {
    console.log('[Popup] Token changé, mise à jour du statut');
    checkAuthStatus();
  }
});

// Vérifier le statut toutes les 10 secondes
setInterval(loadStatus, 10000);

