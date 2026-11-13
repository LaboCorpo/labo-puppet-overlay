/*
 * Plain-text report for troubleshooting: versions, statuses, settings (secrets removed) and the end of the log.
 * Shared by hand (clipboard), so it leaves out tokens and the per-member settings.
 */
const fs = require('fs');
const os = require('os');

const LOG_LINES = 150;

function tail(file, lines) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.split('\n').filter(Boolean).slice(-lines).join('\n');
  } catch (e) { return '(no log)'; }
}

/** info: { version, portable, versions, locale, state (appState()), store, logFile } */
function buildDiagnostics(info) {
  const { state, store } = info;
  const d = state.discord || {}, tw = state.twitchStatus || {}, sy = state.syncStatus || {}, up = state.app.update || {};
  const settings = JSON.parse(JSON.stringify(store.settings));
  settings.discord.clientSecret = settings.discord.clientSecret ? '(set)' : '';
  settings.members = `(${Object.keys(settings.members).length} entries)`;
  settings.memberOrder = `(${settings.memberOrder.length} entries)`;
  const v = info.versions || {};
  const lines = [
    `Puppet Overlay diagnostics — ${new Date().toISOString()}`,
    `Version: ${info.version} (${info.portable ? 'portable' : 'installed'}) · Electron ${v.electron || '?'} · Chrome ${v.chrome || '?'}`,
    `System: ${os.type()} ${os.release()} ${os.arch()} · locale ${info.locale} · UI ${state.app.lang}`,
    `Displays: ${(state.app.displays || []).map((x) => x.label).join(', ')}`,
    `Discord: ${d.status || '?'}${d.detail ? ' — ' + d.detail : ''} · in a channel: ${d.channel ? 'yes' : 'no'} · members: ${(d.members || []).length} · signed in: ${d.me ? 'yes' : 'no'}`,
    `Twitch: ${tw.status || '?'}${tw.detail ? ' — ' + tw.detail : ''}`,
    `Sync: ${sy.status || '?'}${sy.count !== undefined ? ' · ' + sy.count + ' avatars' : ''}${sy.error ? ' — ' + sy.error : ''}`,
    `Update: ${up.status || '?'}${up.latest ? ' · latest ' + up.latest : ''}${up.error ? ' — ' + up.error : ''}`,
    `Avatars: ${Object.keys(store.data.avatars).length} imported, ${Object.keys(store.data.syncedAvatars).length} synced · known members: ${Object.keys(store.data.known).length}`,
    `Hotkey errors: ${JSON.stringify(state.app.hotkeyErrors || {})}`,
    '',
    '--- Settings ---',
    JSON.stringify(settings, null, 1),
    '',
    `--- Last ${LOG_LINES} log lines ---`,
    tail(info.logFile, LOG_LINES),
  ];
  return lines.join('\n');
}

module.exports = { buildDiagnostics };
