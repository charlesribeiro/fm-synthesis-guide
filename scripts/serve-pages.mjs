// Local-only GitHub Pages emulator: missing routes return 404.html with HTTP 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist/pages/browser');
const prefix = '/fm-synthesis-guide/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.ico': 'image/x-icon', '.md': 'text/plain', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    let file = resolve(root, path.slice(prefix.length) || 'index.html');
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      await stat(file);
    } catch {
      file = resolve(root, '404.html');
      status = 404;
    }
    const body = await readFile(file);
    res.writeHead(status, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(400); res.end(); }
}).listen(4202, '127.0.0.1', () => console.log('Pages emulator: http://127.0.0.1:4202/fm-synthesis-guide/'));
