// Content script pour Twitch - Twitch Live Notifier

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

console.log('[Content] Content script chargé sur', window.location.href);

// Ce script peut être utilisé pour des interactions avec la page Twitch
// Pour l'instant, l'essentiel du travail est fait dans background.js

// Écouter les messages depuis le background
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message reçu:', request);
  
  if (request.action === 'getPageInfo') {
    sendResponse({
      url: window.location.href,
      title: document.title
    });
  }
  
  return true; // Indiquer que la réponse sera envoyée de manière asynchrone
});
