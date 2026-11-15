/*
 * Fake Discord IPC server for local tests: 4 users in a voice channel, random speaking events.
 * Linux/macOS: $XDG_RUNTIME_DIR/discord-ipc-<n>. Windows: \\?\pipe\discord-ipc-<n>.
 * Usage: node tools/mock-discord.js [pipeIndex]   (use a free index when the real Discord app is running)
 */
'use strict';
const net = require('net');
const fs = require('fs');

const index = Number(process.argv[2] || 0);
const pipe = process.platform === 'win32'
  ? `\\\\?\\pipe\\discord-ipc-${index}`
  : `${(process.env.XDG_RUNTIME_DIR || '/tmp').replace(/\/$/, '')}/discord-ipc-${index}`;
if (process.platform !== 'win32') try { fs.unlinkSync(pipe); } catch (e) { /* not there */ }

const USERS = [
  { id: '111111111111111111', username: 'timo' },
  { id: '222222222222222222', username: 'lea', global_name: 'Léa' },
  { id: '333333333333333333', username: 'max' },
  { id: '444444444444444444', username: 'sam' },
];

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data));
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
      if (buf.length < 8 + len) break;
      const msg = JSON.parse(buf.subarray(8, 8 + len));
      buf = buf.subarray(8 + len);
      if (op === 0) { sock.write(encode(1, { cmd: 'DISPATCH', evt: 'READY', data: { user: USERS[0] } })); continue; }
      const reply = (data) => sock.write(encode(1, { cmd: msg.cmd, nonce: msg.nonce, data }));
      if (msg.cmd === 'AUTHENTICATE') reply({ user: USERS[0] });
      else if (msg.cmd === 'GET_SELECTED_VOICE_CHANNEL') reply({ id: '99', name: 'Général', voice_states: USERS.map((u, i) => ({ user: u, voice_state: { self_mute: i === 3 } })) });
      else reply({});
    }
  });
  const timer = setInterval(() => {
    const u = USERS[Math.floor(Math.random() * 3)];
    sock.write(encode(1, { cmd: 'DISPATCH', evt: Math.random() < 0.5 ? 'SPEAKING_START' : 'SPEAKING_STOP', data: { user_id: u.id } }));
  }, 700);
  sock.on('close', () => clearInterval(timer));
  sock.on('error', () => {});
}).listen(pipe, () => console.log('mock Discord listening on ' + pipe));
