// Éléments DOM
const minIntervalInput = document.getElementById('minInterval');
const maxIntervalInput = document.getElementById('maxInterval');
const messagesList = document.getElementById('messagesList');
const addMessageBtn = document.getElementById('addMessageBtn');
const notifyOnLiveCheckbox = document.getElementById('notifyOnLive');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

let messages = [];

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderMessages();
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

// Charger les paramètres
async function loadSettings() {
  try {
    const browserAPI = getBrowserAPI();
    const result = await browserAPI.storage.local.get(['messages', 'minInterval', 'maxInterval']);
    
    // Vérifier que result existe
    if (result) {
      messages = result.messages || [
        "Salut ! 👋",
        "Super live comme toujours !",
        "Continue comme ça !",
        "Tu gères ! 🔥"
      ];
      
      minIntervalInput.value = result.minInterval || 15;
      maxIntervalInput.value = result.maxInterval || 40;
    } else {
      // Valeurs par défaut si result est undefined
      messages = [
        "Salut ! 👋",
        "Super live comme toujours !",
        "Continue comme ça !",
        "Tu gères ! 🔥"
      ];
      minIntervalInput.value = 15;
      maxIntervalInput.value = 40;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
    // Valeurs par défaut en cas d'erreur
    messages = [
      "Salut ! 👋",
      "Super live comme toujours !",
      "Continue comme ça !",
      "Tu gères ! 🔥"
    ];
    minIntervalInput.value = 15;
    maxIntervalInput.value = 40;
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    // Valider les valeurs
    const minInterval = parseInt(minIntervalInput.value);
    const maxInterval = parseInt(maxIntervalInput.value);
    
    if (minInterval < 1 || maxInterval < 1) {
      showStatusMessage('Les intervalles doivent être d\'au moins 1 minute', 'error');
      return;
    }
    
    if (minInterval >= maxInterval) {
      showStatusMessage('L\'intervalle minimum doit être inférieur au maximum', 'error');
      return;
    }
    
    const browserAPI = getBrowserAPI();
    await browserAPI.storage.local.set({
      messages: messages,
      minInterval: minInterval,
      maxInterval: maxInterval
    });
    
    showStatusMessage('Paramètres enregistrés avec succès !', 'success');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    showStatusMessage('Erreur lors de la sauvegarde', 'error');
  }
}

// Réinitialiser les paramètres
async function resetSettings() {
  if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
    messages = [
      "Salut ! 👋",
      "Super live comme toujours !",
      "Continue comme ça !",
      "Tu gères ! 🔥"
    ];
    minIntervalInput.value = 15;
    maxIntervalInput.value = 40;
    
    renderMessages();
    await saveSettings();
    showStatusMessage('Paramètres réinitialisés', 'success');
  }
}

// Rendre la liste des messages
function renderMessages() {
  messagesList.innerHTML = '';
  
  messages.forEach((message, index) => {
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';
    
    messageItem.innerHTML = `
      <input type="text" class="message-input" value="${message}" 
             data-index="${index}" placeholder="Tapez votre message...">
      <button class="btn-remove" data-index="${index}">×</button>
    `;
    
    messagesList.appendChild(messageItem);
  });
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
  // Ajouter un message
  addMessageBtn.addEventListener('click', () => {
    messages.push('');
    renderMessages();
    focusLastMessage();
  });
  
  // Modifier un message
  messagesList.addEventListener('input', (e) => {
    if (e.target.classList.contains('message-input')) {
      const index = parseInt(e.target.dataset.index);
      messages[index] = e.target.value;
    }
  });
  
  // Supprimer un message
  messagesList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove')) {
      const index = parseInt(e.target.dataset.index);
      messages.splice(index, 1);
      renderMessages();
    }
  });
  
  // Sauvegarder
  saveBtn.addEventListener('click', saveSettings);
  
  // Réinitialiser
  resetBtn.addEventListener('click', resetSettings);
}

// Focus sur le dernier message
function focusLastMessage() {
  setTimeout(() => {
    const lastInput = messagesList.querySelector('.message-item:last-child .message-input');
    if (lastInput) {
      lastInput.focus();
    }
  }, 100);
}

// Afficher un message de statut
function showStatusMessage(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }, 3000);
}

