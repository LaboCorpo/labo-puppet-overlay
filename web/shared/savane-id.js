/*
 * La savane: stream ids shared by the room window, the OBS pages and the panel.
 * Your camera's id depends only on the room and your name, so its OBS link stays the same between sessions.
 */
(function (root) {
  'use strict';
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const slug = (s) => String(s || '').normalize('NFD').replace(/[^\w]/g, '').slice(0, 20);
  /** Name used in the room: the "Your name" setting, else the Twitch login. '' = not known yet. */
  const nameOf = (cfg, twitchLogin) => String((cfg && cfg.name) || twitchLogin || '');
  const streamId = (room, name) => 'L' + hash(room) + '_' + (slug(name) || 'guest');
  root.SavaneId = { hash, slug, nameOf, streamId };
})(typeof window !== 'undefined' ? window : globalThis);
