// Script pour oauth-callback.html (hébergé sur quilegan.ovh)
// Compatible Firefox et Chrome

// Récupérer les paramètres depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');
const errorDescription = urlParams.get('error_description');

// Récupérer le token depuis le hash (#)
const hash = window.location.hash.substring(1);
const hashParams = new URLSearchParams(hash);
const accessToken = hashParams.get('access_token');
const expiresIn = hashParams.get('expires_in');

const statusDiv = document.getElementById('status');
const messageDiv = document.getElementById('message');

if (error) {
  statusDiv.className = 'status error';
  statusDiv.textContent = '❌ Erreur d\'authentification';
  messageDiv.textContent = errorDescription || error;
} else if (accessToken) {
  statusDiv.className = 'status success';
  statusDiv.textContent = '✅ Authentification réussie !';
  messageDiv.innerHTML = '<p>Token reçu ! Transférant à l\'extension...</p>';
  
  // Sauvegarder dans localStorage (le listener le récupérera)
  try {
    localStorage.setItem('twitch_oauth_token', accessToken);
    localStorage.setItem('twitch_oauth_timestamp', Date.now().toString());
    
    // Envoyer un message postMessage pour que le listener l'écoute
    window.postMessage({
      type: 'TWITCH_OAUTH_TOKEN',
      token: accessToken
    }, '*');
    
    messageDiv.innerHTML = '<p>✅ Token sauvegardé !</p><p style="font-size: 12px;">L\'extension va le récupérer automatiquement.</p>';
  } catch (err) {
    messageDiv.innerHTML = `
      <p>⚠️ Erreur lors de la sauvegarde</p>
      <p style="font-size: 11px;">Token: ${accessToken.substring(0, 20)}...</p>
    `;
  }
  
} else {
  statusDiv.className = 'status error';
  statusDiv.textContent = '⚠️ Aucun token reçu';
  messageDiv.textContent = 'Vérifiez votre configuration OAuth.';
}
