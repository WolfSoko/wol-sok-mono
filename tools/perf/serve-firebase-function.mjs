// Serves an SSR build of Nitro's `firebase` preset on a plain port, as
// Firebase Hosting does, for Lighthouse (ADR 0014, gate 4): the files of the
// public folder first, every other path to the function. The preset exports
// an `onRequest` function instead of listening; it is a (req, res) handler.
//   node tools/perf/serve-firebase-function.mjs <server/index.mjs> <public dir> <port>
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
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

/** The public file a request names, or null - never outside the folder. */
async function publicFile(url) {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || path.endsWith('/')) {
    return null;
  }
  const found = await stat(file).catch(() => null);
  return found?.isFile() ? file : null;
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
