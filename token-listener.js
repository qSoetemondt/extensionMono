// Script à injecter dans toutes les pages pour écouter les tokens OAuth
// Compatible Firefox et Chrome

(function() {
  'use strict';
  
  // Détecter l'API du navigateur
  const browserAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : 
                     (typeof browser !== 'undefined' && browser.runtime) ? browser : null;
  
  if (!browserAPI) {
    console.log('[Token Listener] Extension API non disponible');
    return;
  }
  
  // Écouter les messages postMessage
  window.addEventListener('message', function(event) {
    if (event.data.type === 'TWITCH_OAUTH_TOKEN' && event.data.token) {
      console.log('[Token Listener] Token reçu via postMessage');
      
      // Sauvegarder le token
      browserAPI.storage.local.set({
        twitch_access_token: event.data.token
      }, () => {
        console.log('[Token Listener] ✅ Token sauvegardé');
        
        // Notifier le background
        browserAPI.runtime.sendMessage({
          type: 'OAUTH_TOKEN_RECEIVED',
          token: event.data.token
        });
      });
    }
  });
  
  // Vérifier localStorage immédiatement et toutes les secondes pendant 30 secondes
  // (pour récupérer le token si postMessage ne fonctionne pas)
  let checkCount = 0;
  
  function checkForToken() {
    try {
      // Essayer d'accéder au localStorage de la page
      // Note: localStorage peut ne pas être accessible depuis un content script selon la page
      // On va essayer de le récupérer via window.localStorage
      let token = null;
      
      try {
        // Cette ligne peut échouer si la page utilise un localStorage sandboxed
        token = window.localStorage.getItem('twitch_oauth_token');
      } catch (e) {
        console.log('[Token Listener] localStorage non accessible, utilisation de window.localStorage');
        // Essayer via window
        if (window.localStorage) {
          token = window.localStorage.getItem('twitch_oauth_token');
        }
      }
      
      if (token) {
        console.log('[Token Listener] Token trouvé dans localStorage:', token.substring(0, 20) + '...');
        
        browserAPI.storage.local.set({
          twitch_access_token: token,
          twitch_oauth_timestamp: Date.now()
        }, () => {
          console.log('[Token Listener] ✅ Token transféré depuis localStorage à l\'extension');
          
          // Supprimer le token de localStorage
          try {
            localStorage.removeItem('twitch_oauth_token');
            localStorage.removeItem('twitch_oauth_timestamp');
          } catch (e) {
            console.log('[Token Listener] Impossible de supprimer de localStorage');
          }
          
          // Notifier le background
          browserAPI.runtime.sendMessage({
            type: 'OAUTH_TOKEN_RECEIVED',
            token: token
          }).catch(err => {
            console.log('[Token Listener] Erreur notification background:', err);
          });
          
          clearInterval(checkInterval);
        });
        
        return true;
      }
    } catch (error) {
      console.error('[Token Listener] Erreur lors de la vérification:', error);
    }
    
    checkCount++;
    if (checkCount >= 30) {
      clearInterval(checkInterval);
    }
    
    return false;
  }
  
  const checkInterval = setInterval(checkForToken, 500); // Vérifier toutes les 500ms
  
  console.log('[Token Listener] Actif sur', window.location.href);
  
  // Essayer immédiatement une première fois
  setTimeout(() => {
    checkForToken();
  }, 100);
})();

