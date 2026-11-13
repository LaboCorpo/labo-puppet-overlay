/* Tiny file logger: %APPDATA%/Puppet Overlay/logs/main.log, rotated to main.old.log at 1 MB. */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1_000_000;

function createLogger(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'main.log');
  let size = 0;
  try { size = fs.statSync(file).size; } catch (e) { /* new file */ }
  const rotate = () => {
    try { fs.renameSync(file, path.join(dir, 'main.old.log')); size = 0; } catch (e) { /* keep appending */ }
  };
  if (size > MAX_BYTES) rotate();
  const write = (level, msg) => {
    const line = `${new Date().toISOString()} [${level}] ${String(msg).slice(0, 4000)}\n`;
    try { fs.appendFileSync(file, line); size += line.length; } catch (e) { /* disk full or locked: console only */ }
    if (size > MAX_BYTES) rotate();
    (level === 'error' ? console.error : console.log)(line.trim());
  };
  return { dir, file, info: (m) => write('info', m), warn: (m) => write('warn', m), error: (m) => write('error', m) };
}

module.exports = { createLogger };
