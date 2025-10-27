// Détecter le navigateur et utiliser l'API appropriée
function getBrowserAPI() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  throw new Error('Extension API not available');
}

const browserAPI = getBrowserAPI();

// Vérifier que l'API est disponible
console.log('[Background] Browser API détecté:', {
  hasRuntime: !!browserAPI.runtime,
  hasStorage: !!browserAPI.storage,
  hasTabs: !!browserAPI.tabs,
  hasNotifications: !!browserAPI.notifications
});

// Configuration par défaut
const TWITCH_USERNAME = 'monodie';
const TWITCH_URL = `https://www.twitch.tv/${TWITCH_USERNAME}`;

// Variables globales
let isLive = false;
let checkInterval = null;
let liveTabId = null;
let messageTimeout = null;
let ircSocket = null;
let ircConnected = false;

const CHECK_INTERVAL_MS = 60000; // Vérifier toutes les minutes

// Initialisation pour Chrome Service Worker
if ('serviceWorker' in navigator || typeof browserAPI.action !== 'undefined') {
  // Service Worker Chrome
  console.log('[Background] 🚀 Service Worker initialisé (Chrome)');
  loadSettings().then(() => {
    startMonitoring();
  });
} else {
  // Background Script Firefox
  console.log('[Background] 🚀 Background Script initialisé (Firefox)');
  loadSettings();
  startMonitoring();
}

// Écouter l'activation du service worker (Chrome)
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('[Background] ✅ Extension Twitch Live Notifier installée');
  loadSettings().then(() => {
    startMonitoring();
  });
});

// Réactiver au démarrage pour les service workers Chrome
browserAPI.runtime.onStartup?.addListener(() => {
  console.log('[Background] 🚀 Service Worker démarré');
  loadSettings().then(() => {
    startMonitoring();
  });
});

// Charger les paramètres depuis le storage
async function loadSettings() {
  try {
    let result = await browserAPI.storage.local.get([
      'autoOpen',
      'muted',
      'autoMessages',
      'messages',
      'minInterval',
      'maxInterval'
    ]);
    
    // Vérifier que result existe
    if (!result || typeof result !== 'object') {
      console.log('[Background] Aucune configuration trouvée, utilisation des valeurs par défaut');
      result = {};
    }
    
    // Valeurs par défaut
    if (!result.autoOpen) {
      await browserAPI.storage.local.set({ autoOpen: true });
    }
    if (!result.muted) {
      await browserAPI.storage.local.set({ muted: true });
    }
    if (!result.autoMessages && result.autoMessages !== false) {
      await browserAPI.storage.local.set({ autoMessages: true });
    }
    if (!result.messages || result.messages.length === 0) {
      const defaultMessages = [
        "Salut ! 👋",
        "Super live comme toujours !",
        "Continue comme ça !",
        "Tu gères ! 🔥"
      ];
      await browserAPI.storage.local.set({ messages: defaultMessages });
    }
    if (!result.minInterval) {
      await browserAPI.storage.local.set({ minInterval: 15 }); // 15 minutes par défaut
    }
    if (!result.maxInterval) {
      await browserAPI.storage.local.set({ maxInterval: 40 }); // 40 minutes par défaut
    }
  } catch (error) {
    console.error('[Background] Erreur lors du chargement des paramètres:', error);
  }
}

// Démarrer la surveillance
async function startMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  console.log('[Background] 🚀 Démarrage de la surveillance...');
  
  checkInterval = setInterval(checkLiveStatus, CHECK_INTERVAL_MS);
  
  // Vérifier immédiatement
  await checkLiveStatus();
}

// Arrêter la surveillance
function stopMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Vérifier le statut du live
async function checkLiveStatus() {
  try {
    console.log(`[Background] Vérification du live pour ${TWITCH_USERNAME}...`);
    
    // Utiliser l'API Twitch pour vérifier le statut du live
    // Note: decapi.me retourne du texte simple, pas du JSON
    const response = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_USERNAME}`);
    const data = await response.text(); // Utiliser .text() au lieu de .json()
    
    console.log(`[Background] Réponse de l'API:`, data);
    
    const wasLive = isLive;
    
    // Détecter si c'est en live (l'API retourne "offline", "not found" ou une durée de live)
    isLive = (data !== 'offline' && 
              data !== 'not found' && 
              data !== null && 
              typeof data === 'string' && 
              data.length > 0 &&
              data !== '');
    
    console.log(`[Background] Statut live: ${isLive} (ancien: ${wasLive})`);
    
    if (isLive && !wasLive) {
      // Le live vient de commencer
      console.log('[Background] ✅ Live détecté !');
      await handleLiveStart();
    } else if (!isLive && wasLive) {
      // Le live s'est arrêté
      console.log('[Background] ⚪ Live terminé');
      stopMessageInterval();
    } else if (isLive) {
      console.log('[Background] 🔴 Toujours en live');
    } else {
      console.log('[Background] ⚪ Pas en live actuellement');
    }
  } catch (error) {
    console.error('[Background] Erreur lors de la vérification du live:', error);
  }
}

// Gérer le début du live
async function handleLiveStart() {
  try {
    const settings = await browserAPI.storage.local.get(['autoOpen', 'muted']);
    
    // Valeurs par défaut si settings est undefined
    const autoOpen = settings?.autoOpen !== false;
    const muted = settings?.muted !== false;
    
    console.log('[Background] Settings:', { autoOpen, muted });
    
    // Envoyer une notification
    browserAPI.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🎬 Live démarré !',
      message: `${TWITCH_USERNAME} est en live sur Twitch !`,
      priority: 2
    });
    
    // Ouvrir le live dans un onglet si activé
    if (autoOpen && browserAPI.tabs && browserAPI.tabs.create) {
      try {
        browserAPI.tabs.create({
          url: TWITCH_URL,
          active: false,
          pinned: false
        }).then(tab => {
          liveTabId = tab.id;
          
          console.log('[Background] Onglet créé:', liveTabId);
          
          // Muter l'onglet si demandé
          if (muted && browserAPI.tabs && browserAPI.tabs.update) {
            browserAPI.tabs.update(liveTabId, { muted: true }).catch(err => {
              console.error('[Background] Erreur lors du mute:', err);
            });
          }
          
          // Connecter IRC et démarrer l'envoi de messages
          connectIRC().then(() => {
            startMessageInterval();
          });
        }).catch(err => {
          console.error('[Background] Erreur lors de la création de l\'onglet:', err);
        });
      } catch (err) {
        console.error('[Background] Erreur tabs.create:', err);
      }
    } else {
      console.warn('[Background] tabs.create non disponible');
      // Connecter IRC et démarrer quand même les messages
      connectIRC().then(() => {
        startMessageInterval();
      });
    }
  } catch (error) {
    console.error('[Background] Erreur lors de handleLiveStart:', error);
  }
}

// Générer un temps aléatoire en millisecondes
function getRandomTime(minMinutes, maxMinutes) {
  const minMs = minMinutes * 60000;
  const maxMs = maxMinutes * 60000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Démarrer l'envoi de messages automatique avec temps aléatoire
function startMessageInterval() {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  
  scheduleNextMessage();
}

// Programmer le prochain message avec un temps aléatoire
function scheduleNextMessage() {
  browserAPI.storage.local.get(['messages', 'minInterval', 'maxInterval']).then(result => {
    if (!result.messages || result.messages.length === 0) {
      console.log('[Background] Aucun message configuré');
      return;
    }
    
    const minInterval = result.minInterval || 15; // 15 minutes par défaut
    const maxInterval = result.maxInterval || 40; // 40 minutes par défaut
    
    const randomTime = getRandomTime(minInterval, maxInterval);
    
    console.log(`[Background] Prochain message dans ${Math.round(randomTime / 60000)} minutes`);
    
    // Programmer le message
    messageTimeout = setTimeout(() => {
      sendRandomMessage();
      scheduleNextMessage(); // Programmer le message suivant
    }, randomTime);
  });
}

// Arrêter l'envoi de messages
function stopMessageInterval() {
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
  
  // Fermer la connexion IRC si elle existe
  if (ircSocket) {
    ircSocket.close();
    ircSocket = null;
    ircConnected = false;
  }
}

// Envoyer un message aléatoire via IRC
async function sendRandomMessage() {
  const result = await browserAPI.storage.local.get(['messages', 'twitch_access_token', 'autoMessages']);
  
  // Vérifier si l'envoi automatique est activé
  if (result.autoMessages === false) {
    console.log('[Background] Envoi automatique de messages désactivé');
    return;
  }
  
  if (!result.messages || result.messages.length === 0) {
    console.log('[Background] Aucun message configuré');
    return;
  }
  
  if (!result.twitch_access_token) {
    console.warn('[Background] Pas de token OAuth, impossible d\'envoyer via IRC');
    return;
  }
  
  const messages = result.messages;
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  
  console.log('[Background] 📤 Envoi du message via IRC:', randomMessage);
  
  try {
    // Envoyer via IRC Twitch
    await sendMessageViaIRC(TWITCH_USERNAME, randomMessage);
    console.log('[Background] ✅ Message envoyé via IRC');
  } catch (error) {
    console.error('[Background] Erreur envoi IRC:', error);
  }
}

// Fonction pour maintenir une connexion IRC persistante
async function connectIRC() {
  const result = await browserAPI.storage.local.get(['twitch_access_token', 'twitch_username']);
  
  if (!result.twitch_access_token) {
    console.error('[IRC] Pas de token OAuth disponible');
    return;
  }
  
  // Récupérer le nom d'utilisateur depuis le token ou les paramètres
  const username = result.twitch_username || TWITCH_USERNAME;
  
  // Fermer l'ancienne connexion si elle existe
  if (ircSocket) {
    ircSocket.close();
  }
  
  ircSocket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  
  ircSocket.onopen = () => {
    console.log('[IRC] Connexion WebSocket établie');
    
    // Authentifier
    ircSocket.send(`PASS oauth:${result.twitch_access_token}`);
    ircSocket.send(`NICK ${username}`);
    
    // Joindre le channel
    setTimeout(() => {
      ircSocket.send(`JOIN #${TWITCH_USERNAME}`);
      console.log(`[IRC] Rejoint #${TWITCH_USERNAME}`);
    }, 500);
  };
  
  ircSocket.onmessage = (event) => {
    const data = event.data;
    
    // Répondre au PING
    if (data.startsWith('PING')) {
      ircSocket.send('PONG :tmi.twitch.tv');
      console.log('[IRC] PONG envoyé');
    }
    
    // Détecter quand on est connecté
    if (data.includes('001') || data.includes(':tmi.twitch.tv 001')) {
      ircConnected = true;
      console.log('[IRC] ✅ Authentifié et connecté');
    }
    
    // Vérifier si on a rejoint le channel
    if (data.includes(`:${username}!`) && data.includes(`JOIN #${TWITCH_USERNAME}`)) {
      console.log(`[IRC] ✅ Rejoint #${TWITCH_USERNAME}`);
    }
  };
  
  ircSocket.onerror = (error) => {
    console.error('[IRC] Erreur:', error);
    ircConnected = false;
  };
  
  ircSocket.onclose = () => {
    console.log('[IRC] Connexion fermée');
    ircConnected = false;
    
    // Tentative de reconnexion après 5 secondes si on est toujours en live
    if (isLive) {
      setTimeout(() => {
        console.log('[IRC] Tentative de reconnexion...');
        connectIRC();
      }, 5000);
    }
  };
}

// Fonction pour envoyer un message via IRC
async function sendMessageViaIRC(channel, message) {
  if (!ircSocket || !ircConnected) {
    console.log('[IRC] Connexion non prête, connexion...');
    await connectIRC();
    
    // Attendre que la connexion soit prête
    let attempts = 0;
    while (!ircConnected && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (!ircConnected) {
      throw new Error('Impossible de se connecter à IRC');
    }
  }
  
  // Envoyer le message
  ircSocket.send(`PRIVMSG #${channel} :${message}`);
  console.log(`[IRC] Message envoyé sur #${channel}: ${message}`);
}

// Fonction de test pour forcer l'envoi d'un message
// Exposer dans l'API globale pour être accessible depuis la console
try {
  if (typeof self !== 'undefined') {
    self.testSendMessage = function() {
      console.log('[Background] 🧪 Test d\'envoi de message...');
      sendRandomMessage();
    };
  }
} catch(e) {
  console.log('[Background] Pas de self disponible');
}

// Alternative : exposer via une fonction globale
globalThis.testSendMessage = function() {
  console.log('[Background] 🧪 Test d\'envoi de message...');
  sendRandomMessage();
};

console.log('[Background] 💡 Fonction de test disponible: testSendMessage()');

// Écouter les messages depuis le popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Message reçu:', request);
  
  if (request.action === 'checkStatus') {
    console.log(`[Background] Statut demandé, isLive=${isLive}`);
    sendResponse({ isLive });
    return true; // Important pour Firefox async responses
  } else if (request.action === 'startMonitoring') {
    startMonitoring();
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'toggleMute') {
    if (liveTabId) {
      browserAPI.tabs.get(liveTabId).then(tab => {
        browserAPI.tabs.update(liveTabId, { muted: !tab.mutedInfo.muted });
      });
    }
    sendResponse({ success: true });
    return true;
  } else if (request.type === 'OAUTH_TOKEN_RECEIVED') {
    // Sauvegarder le token reçu
    browserAPI.storage.local.set({
      twitch_access_token: request.token
    });
    console.log('[Background] ✅ Token OAuth reçu et sauvegardé');
    sendResponse({ success: true });
    return true;
  }
});

// Nettoyer lors de la désinstallation
browserAPI.runtime.onSuspend.addListener(() => {
  stopMonitoring();
  stopMessageInterval();
});

// Réinitialiser le timer du message si les paramètres changent
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.minInterval || changes.maxInterval)) {
    // Si un message est déjà programmé, le relancer avec les nouveaux paramètres
    if (messageTimeout) {
      stopMessageInterval();
      if (isLive) {
        startMessageInterval();
      }
    }
  }
  
  // Si le token change et que IRC est connecté, reconnecter
  if (changes.twitch_access_token && ircSocket) {
    console.log('[Background] Token changé, reconnexion IRC...');
    stopMessageInterval();
    if (isLive) {
      connectIRC().then(() => {
        startMessageInterval();
      });
    }
  }
});

