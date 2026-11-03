import { baseUrl, get, isEntryPoint, readInput, sessionOf } from './shared.mjs';

export function waitBlock(id) {
  return [
    'for i in $(seq 1 110); do',
    `curl -s --max-time 5 ${baseUrl()}/api/cockpit/request/${id}/answer -G -d wait=4 | grep -qE '"decision"|Unknown request' && break`,
    'sleep 1',
    'done',
    `curl -s --max-time 5 ${baseUrl()}/api/cockpit/request/${id}/answer`,
  ].join('\n');
}

export function reasonFor(request) {
  if (request.state === 'decided') {
    return (
      `Request ${request.id} is decided, but its answer was not fetched. Fetch it now and act on it ` +
      `as the cockpit skill says:\ncurl -s --max-time 5 ${baseUrl()}/api/cockpit/request/${request.id}/answer`
    );
  }
  return (
    `Request ${request.id} is open, but no wait is running. Run the cockpit skill's wait block for it once ` +
    `as a background command and act on the answer. If it ends without one, restart it once, then end your turn: ` +
    `the next hook or start fetches the answer.\n${waitBlock(request.id)}`
  );
}

/** `null`: nothing to block on. Every failure counts as nothing: the hook must never hold a session. */
export async function unattendedRequest(session) {
  const answer = await get(`/api/cockpit/session/${session}/unattended-request`, {}, 2000);
  if (answer?.status !== 200) return null;
  const body = JSON.parse(answer.text);
  const request = body?.ok === true ? body.request : null;
  return typeof request?.id === 'number' && typeof request.state === 'string' ? request : null;
}

async function main() {
  const input = await readInput();
  if (input === null || input.stop_hook_active === true) return;
  const session = sessionOf(input);
  if (session === null) return;
  const request = await unattendedRequest(session);
  if (request === null) return;
  process.stdout.write(JSON.stringify({ decision: 'block', reason: reasonFor(request) }));
}

if (isEntryPoint(import.meta.url)) {
  main()
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
    });
}
