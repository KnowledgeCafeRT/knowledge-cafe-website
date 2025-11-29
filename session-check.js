// session-check.js
// FÜGE DAS AM ANFANG VON KASSE.HTML UND ANDEREN GESCHÜTZTEN SEITEN EIN

function checkPOSSession() {
  const session = sessionStorage.getItem('pos_session');
  
  if (!session) {
    alert('⚠️ Bitte zuerst einloggen!');
    window.location.href = 'pos-login.html';
    return;
  }
  
  const sessionData = JSON.parse(session);
  const sessionTimeout = 15 * 60 * 1000; // 15 Minuten
  
  // Session abgelaufen?
  if (Date.now() - sessionData.loginTime > sessionTimeout) {
    alert('⏱️ Session abgelaufen! Bitte neu einloggen.');
    sessionStorage.removeItem('pos_session');
    window.location.href = 'pos-login.html';
    return;
  }
  
  // Zeige wer eingeloggt ist
  console.log('✅ Eingeloggt als:', sessionData.name);
  
  // Emergency PIN Warning
  if (sessionData.isEmergency) {
    const warning = document.createElement('div');
    warning.style.cssText = 'background: #ff9800; color: white; padding: 1rem; text-align: center; font-weight: 600; position: fixed; top: 0; left: 0; right: 0; z-index: 10000;';
    warning.textContent = '⚠️ NOTFALL-PIN AKTIV - Bitte informiere einen Manager!';
    document.body.prepend(warning);
  }
}

// Auto-Logout bei Inaktivität
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  
  // Update session time
  const session = sessionStorage.getItem('pos_session');
  if (session) {
    const sessionData = JSON.parse(session);
    sessionData.loginTime = Date.now();
    sessionStorage.setItem('pos_session', JSON.stringify(sessionData));
  }
  
  inactivityTimer = setTimeout(() => {
    alert('⏱️ Auto-Logout wegen Inaktivität');
    sessionStorage.removeItem('pos_session');
    window.location.href = 'pos-login.html';
  }, 15 * 60 * 1000);
}

// Bei Aktivität Timer zurücksetzen
['mousemove', 'keypress', 'click', 'touchstart'].forEach(event => {
  document.addEventListener(event, resetInactivityTimer);
});

// Logout Funktion
function logout() {
  if (confirm('Wirklich ausloggen?')) {
    sessionStorage.removeItem('pos_session');
    window.location.href = 'pos-login.html';
  }
}

// Check Session beim Page Load
window.addEventListener('DOMContentLoaded', checkPOSSession);

