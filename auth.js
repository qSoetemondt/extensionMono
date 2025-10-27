// Script pour la page d'authentification

const TWITCH_CLIENT_ID = 'hosgbbppj0rlvp9pvwylixbtrti3zn';
const TWITCH_REDIRECT_URI = 'https://quilegan.ovh/oauth-callback';

// Vérifier si déjà authentifié
function checkAuth() {
  chrome.storage.local.get(['twitch_access_token'], (result) => {
    if (result.twitch_access_token) {
      document.getElementById('authStatus').innerHTML = '<p style="color: green;">✅ Connecté</p>';
      document.getElementById('authBtn').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'block';
    }
  });
}

// Bouton d'authentification
document.getElementById('authBtn').addEventListener('click', () => {
  const authURL = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}&response_type=token&scope=chat:read+chat:edit&force_verify=true`;
  
  // Ouvrir dans une nouvelle fenêtre
  const popup = window.open(authURL, 'Twitch Auth', 'width=600,height=700');
  
  // Écouter les messages de la popup
  window.addEventListener('message', (event) => {
    if (event.data.type === 'TWITCH_AUTH_SUCCESS') {
      popup.close();
      checkAuth();
      chrome.runtime.sendMessage({ type: 'AUTH_SUCCESS' });
    }
  });
});

// Bouton de déconnexion
document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['twitch_access_token', 'twitch_refresh_token'], () => {
    checkAuth();
    chrome.runtime.sendMessage({ type: 'LOGOUT' });
  });
});

checkAuth();

