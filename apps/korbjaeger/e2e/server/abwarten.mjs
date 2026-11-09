// Waits until a server Nx starts answers at `url`, then stays up until
// Playwright ends it: the `webServer` command inside an Nx task, where Nx,
// not Playwright, runs the servers (`nx-server.ts`). Exits 1 after
// `timeoutMs` without an answer.
const [url, timeoutMs = '120000'] = process.argv.slice(2);
const ABSTAND_MS = 250;
const bis = Date.now() + Number(timeoutMs);

/** As Playwright takes a server for up: any status below 404. */
async function antwortet() {
  try {
    const antwort = await fetch(url, { redirect: 'manual' });
    return antwort.status < 404;
  } catch {
    return false;
  }
}

while (!(await antwortet())) {
  if (Date.now() > bis) {
    console.error(`No server answered at ${url} within ${timeoutMs} ms.`);
    process.exit(1);
  }
  await new Promise((weiter) => setTimeout(weiter, ABSTAND_MS));
}
console.log(`Server at ${url} is up.`);
// stays up: a webServer command that ends counts as a server gone
setInterval(() => undefined, 60_000);
