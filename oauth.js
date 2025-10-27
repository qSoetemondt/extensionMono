// Configuration OAuth Twitch
// Pour obtenir ces identifiants : https://dev.twitch.tv/console/apps

const TWITCH_CLIENT_ID = 'hosgbbppj0rlvp9pvwylixbtrti3zn'; // À remplacer
const TWITCH_REDIRECT_URI = 'https://quilegan.ovh/oauth-callback'; // À remplacer
const TWITCH_AUTH_URL = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT_URI}&response_type=code&scope=chat%3Aread+chat%3Aedit+channel%3Amoderate`;

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

// Fonction pour démarrer l'authentification OAuth
async function authenticateWithTwitch() {
  try {
    // Sauvegarder l'URL actuelle
    await browserAPI.storage.local.set({ 
      oauth_return_url: window.location.href 
    });
    
    // Rediriger vers la page d'authentification Twitch
    window.location.href = TWITCH_AUTH_URL;
  } catch (error) {
    console.error('Erreur authentification:', error);
  }
}

// Fonction pour récupérer le token depuis le storage
async function getAccessToken() {
  const result = await browserAPI.storage.local.get(['twitch_access_token', 'twitch_refresh_token']);
  return {
    accessToken: result.twitch_access_token,
    refreshToken: result.twitch_refresh_token
  };
}

// Fonction pour sauvegarder le token
async function saveTokens(accessToken, refreshToken) {
  await browserAPI.storage.local.set({
    twitch_access_token: accessToken,
    twitch_refresh_token: refreshToken
  });
}

// Fonction pour échanger le code d'autorisation contre un token
async function exchangeCodeForToken(code) {
  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: "rpczkdhdz36nltjiurcugk1ptcu911",
        code: code,
        grant_type: "authorization_code",
        redirect_uri: TWITCH_REDIRECT_URI,
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      await saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    }
    
    throw new Error('Pas de token reçu');
  } catch (error) {
    console.error('Erreur échange code:', error);
    throw error;
  }
}

// Fonction pour rafraîchir le token
async function refreshAccessToken() {
  const { refreshToken } = await getAccessToken();
  
  if (!refreshToken) {
    throw new Error('Pas de refresh token disponible');
  }
  
  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: TWITCH_CLIENT_ID,
        client_secret: "rpczkdhdz36nltjiurcugk1ptcu911",
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      await saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    }
    
    throw new Error('Impossible de rafraîchir le token');
  } catch (error) {
    console.error('Erreur rafraîchissement token:', error);
    throw error;
  }
}

// Vérifier si l'utilisateur est authentifié
async function isAuthenticated() {
  const { accessToken } = await getAccessToken();
  return !!accessToken;
}

// Déconnexion
async function logout() {
  await browserAPI.storage.local.remove(['twitch_access_token', 'twitch_refresh_token']);
}

// Exposer les fonctions globalement
if (typeof window !== 'undefined') {
  window.oauth = {
    authenticate: authenticateWithTwitch,
    getAccessToken,
    saveTokens,
    exchangeCodeForToken,
    refreshAccessToken,
    isAuthenticated,
    logout
  };
}

