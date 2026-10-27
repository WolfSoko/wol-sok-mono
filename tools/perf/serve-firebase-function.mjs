// Serves an SSR build of Nitro's `firebase` preset on a plain port, as
// Firebase Hosting does, for Lighthouse (ADR 0014, gate 4): the files of the
// public folder first (with `cleanUrls`, as firebase.rollapolla-analog.json
// sets it), every other path to the function. The preset exports
// an `onRequest` function instead of listening; it is a (req, res) handler.
//   node tools/perf/serve-firebase-function.mjs <server/index.mjs> <public dir> <port>
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const [entry, publicDir, port] = process.argv.slice(2);
if (!entry || !publicDir || !port) {
  console.error(
    'Usage: node tools/perf/serve-firebase-function.mjs <server/index.mjs> <public dir> <port>'
  );
  process.exit(2);
}
const root = resolve(publicDir);
const { server } = await import(pathToFileURL(resolve(entry)).href);

/**
 * The public file Hosting would answer a request with, or null: the file
 * itself, a folder's `index.html`, or with `cleanUrls` the path plus
 * `.html` - never a file outside the folder.
 */
async function publicFile(url) {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const base = normalize(join(root, path));
  if (base !== root && !base.startsWith(root + sep)) {
    return null;
  }
  for (const file of [base, join(base, 'index.html'), `${base}.html`]) {
    const found = await stat(file).catch(() => null);
    if (found?.isFile()) {
      return file;
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await publicFile(req.url ?? '/');
  if (file === null) {
    server(req, res);
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
}).listen(Number(port), () =>
  console.log(`Listening on http://localhost:${port}`)
);
