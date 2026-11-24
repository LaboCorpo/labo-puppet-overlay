/*
 * Small wrapper over Electron safeStorage (DPAPI on Windows) for secrets kept in config.json:
 * the OBS WebSocket password, the Discord bot token, the GitHub token. Falls back to plain text
 * ("p:" prefix) when encryption is unavailable, so the app keeps working.
 */
const { safeStorage } = require('electron');

function seal(text) {
  if (!text) return '';
  try { if (safeStorage.isEncryptionAvailable()) return 'e:' + safeStorage.encryptString(String(text)).toString('base64'); } catch (e) { /* fall back */ }
  return 'p:' + Buffer.from(String(text), 'utf8').toString('base64');
}
function open(sealed) {
  if (!sealed || typeof sealed !== 'string') return '';
  try {
    if (sealed.startsWith('e:')) return safeStorage.decryptString(Buffer.from(sealed.slice(2), 'base64'));
    if (sealed.startsWith('p:')) return Buffer.from(sealed.slice(2), 'base64').toString('utf8');
  } catch (e) { /* unreadable (other Windows account?) */ }
  return '';
}
module.exports = { seal, open };
