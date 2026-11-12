/* Tiny file logger: %APPDATA%/Puppet Overlay/logs/main.log (rotated at 1 MB). */
const fs = require('fs');
const path = require('path');

function createLogger(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'main.log');
  try { if (fs.statSync(file).size > 1_000_000) fs.renameSync(file, path.join(dir, 'main.old.log')); } catch (e) {}
  const write = (level, msg) => {
    const line = `${new Date().toISOString()} [${level}] ${msg}\n`;
    try { fs.appendFileSync(file, line); } catch (e) {}
    (level === 'error' ? console.error : console.log)(line.trim());
  };
  return { dir, file, info: (m) => write('info', m), warn: (m) => write('warn', m), error: (m) => write('error', m) };
}

module.exports = { createLogger };
