/**
 * The DBB for e2e and `nx run korbjaeger:serve-e2e`: answers the DBB paths
 * under `/rest/` from the lib's anonymised fixtures (`fakeDbbAnswer`), so
 * no test reaches the real DBB. Run through `nx run korbjaeger:fake-dbb`.
 */
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { createServer } from 'node:http';

const DEFAULT_PORT = 4303;
const API_PREFIX = '/rest/';

const port = Number(process.argv[2] ?? DEFAULT_PORT);

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://fake-dbb');
  const answer = url.pathname.startsWith(API_PREFIX)
    ? fakeDbbAnswer(
        request.method ?? 'GET',
        `${url.pathname.slice(API_PREFIX.length)}${url.search}`
      )
    : undefined;
  if (answer === undefined) {
    response.writeHead(404).end();
    return;
  }
  response
    .writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify(answer));
}).listen(port, () => {
  console.log(`fake DBB on http://localhost:${port}${API_PREFIX}`);
});
