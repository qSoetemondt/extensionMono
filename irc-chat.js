// Module pour envoyer des messages via l'API IRC de Twitch

// Détecter l'API du navigateur
function getBrowserAPI() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  throw new Error('Extension API not available');
}

const browserAPI = getBrowserAPI();

class TwitchIRCChat {
  constructor(accessToken, username) {
    this.accessToken = accessToken;
    this.username = username;
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Se connecter à l'IRC de Twitch
        this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        
        this.socket.onopen = () => {
          console.log('[IRC] Connexion établie');
          
          // Envoyer les commandes d'authentification
          this.socket.send(`PASS oauth:${this.accessToken}`);
          this.socket.send(`NICK ${this.username}`);
          
          this.connected = true;
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          console.log('[IRC] Message reçu:', event.data);
          
          // Répondre au PING pour maintenir la connexion
          if (event.data.startsWith('PING')) {
            this.socket.send('PONG :tmi.twitch.tv');
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[IRC] Erreur:', error);
          reject(error);
        };
        
        this.socket.onclose = () => {
          console.log('[IRC] Connexion fermée');
          this.connected = false;
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(channel, message) {
    if (!this.connected || !this.socket) {
      throw new Error('Non connecté à l\'IRC');
    }
    
    // Le channel doit commencer par #
    const channelName = channel.startsWith('#') ? channel : `#${channel}`;
    
    // Envoyer le message
    this.socket.send(`PRIVMSG ${channelName} :${message}`);
    console.log(`[IRC] Message envoyé sur ${channelName}: ${message}`);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }
}

// Fonction helper pour envoyer un message
async function sendIRCMessage(channel, message) {
  try {
    const { accessToken } = await browserAPI.storage.local.get(['twitch_access_token']);
    const { username } = await browserAPI.storage.local.get(['twitch_username']);
    
    if (!accessToken) {
      throw new Error('Pas de token OAuth disponible');
    }
    
    if (!username) {
      throw new Error('Nom d\'utilisateur non configuré');
    }
    
    const chat = new TwitchIRCChat(accessToken, username);
    await chat.connect();
    
    // Attendre un peu pour que la connexion soit stable
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await chat.sendMessage(channel, message);
    
    // Fermer la connexion après l'envoi
    chat.disconnect();
    
    return true;
  } catch (error) {
    console.error('[IRC] Erreur lors de l\'envoi:', error);
    throw error;
  }
}

// Exposer les fonctions
if (typeof window !== 'undefined') {
  window.twitchIRC = {
    sendMessage: sendIRCMessage,
    TwitchIRCChat
  };
}

