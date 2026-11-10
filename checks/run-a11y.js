// Serves this folder, opens checks/a11y.html in a headless browser, prints what it found,
// and exits with an error if any accessibility problem was reported.
// Usage: npm run a11y        (set BROWSER=<path to Edge or Chrome> if it isn't found)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

const selftest = process.argv.includes('--selftest');
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('No Edge or Chrome found. Set BROWSER to its path and run again.');
  process.exit(2);
}

const server = http.createServer(async (req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/checks/a11y.html${selftest ? '?selftest' : ''}`;
  execFile(browser, ['--headless', '--disable-gpu', '--window-size=1400,1000', '--virtual-time-budget=120000', '--dump-dom', url],
    { maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
      server.close();
      const report = stdout.match(/<pre id="out"[^>]*>([\s\S]*?)<\/pre>/)?.[1] ?? '';
      const text = report.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      console.log(text || '(the check page produced no report)');
      const ok = /A11Y DONE: no problems found/.test(text);
      if (error && !text) console.error(String(error));
      if (selftest) {
        const caught = /A11Y FAIL/.test(text);
        console.log(caught ? 'SELFTEST OK: the planted problem was caught' : 'SELFTEST FAILED: the planted problem was not caught');
        process.exit(caught ? 0 : 1);
      }
      process.exit(ok ? 0 : 1);
    });
});
