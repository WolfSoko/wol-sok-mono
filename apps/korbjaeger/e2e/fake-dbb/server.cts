/**
 * The DBB for e2e and `nx run korbjaeger:serve-e2e`: answers the DBB paths
 * under `/rest/` from the lib's anonymised fixtures (`fakeDbbAnswer`), a
 * POST by its JSON body, so no test reaches the real DBB. Run through
 * `nx run korbjaeger:fake-dbb`.
 */
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createServer, type IncomingMessage } from 'node:http';

/** The fake DBB's port; `vite.config.ts` and the e2e config point at it. */
const PORT = 4303;
const API_PREFIX = '/rest/';

/** The request's body as text; none for a GET. */
async function bodyOf(request: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks).toString();
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://fake-dbb');
  const answer = url.pathname.startsWith(API_PREFIX)
    ? fakeDbbAnswer(
        request.method ?? 'GET',
        `${url.pathname.slice(API_PREFIX.length)}${url.search}`,
        await bodyOf(request)
      )
    : undefined;
  if (answer === undefined) {
    response.writeHead(404).end();
    return;
  }
  response
    .writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify(answer));
}).listen(PORT, () => {
  console.log(`fake DBB on http://localhost:${PORT}${API_PREFIX}`);
});
