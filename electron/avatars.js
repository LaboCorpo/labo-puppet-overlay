/* Avatar validation for everything that enters the store: API imports, the sync file, the saved config. */
require('../web/shared/puppet/avatar.js'); // attaches globalThis.Puppet (format only, no drawing)

const Puppet = globalThis.Puppet;
const ID_RE = /^\d{15,22}$/;

/** Normalises an avatar and checks it can be linked to a Discord user. Throws with a user-facing message. */
function cleanAvatar(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid avatar');
  const a = Puppet.normalize(raw);
  if (!ID_RE.test(a.id)) throw new Error('Missing or invalid Discord ID (17–20 digits)');
  if (raw.photo && !a.photo) throw new Error('Invalid photo');
  return a;
}

/** Cleans a { id: avatar } map, silently dropping invalid entries. */
function cleanAvatarMap(map) {
  const out = {};
  for (const raw of Object.values(map || {})) {
    try { const a = cleanAvatar(raw); out[a.id] = a; } catch (e) { /* drop */ }
  }
  return out;
}

module.exports = { Puppet, cleanAvatar, cleanAvatarMap };
