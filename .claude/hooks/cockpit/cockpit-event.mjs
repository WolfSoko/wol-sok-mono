import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runsAsHook, markerPath, post, readInput, sessionOf } from './shared.mjs';

const TEXT_MAX = 4000;
const CWD_MAX = 1000;
const TOOL_REPORT_EVERY_MS = 5 * 60_000;

// The end, not the start: the question sits at the close of the answer.
export function keepEnd(text, max = TEXT_MAX) {
  if (typeof text !== 'string') return null;
  if (text.length <= max) return text;
  return '…' + text.slice(text.length - (max - 1));
}

export function eventBody(input) {
  const sitzung = sessionOf(input);
  if (sitzung === null) return null;
  const cwd = typeof input.cwd === 'string' ? input.cwd.slice(0, CWD_MAX) : null;
  switch (input.hook_event_name) {
    case 'Stop':
      return { sitzung, ereignis: 'stop', cwd, text: keepEnd(input.last_assistant_message) };
    case 'Notification':
      return {
        sitzung,
        ereignis: 'notification',
        cwd,
        typ: typeof input.notification_type === 'string' ? input.notification_type : null,
        text: keepEnd(input.message),
      };
    // The prompt itself stays in the session; the routine only needs "it went on".
    case 'UserPromptSubmit':
      return { sitzung, ereignis: 'prompt', cwd };
    // A long turn runs no other hook, and without a report it would read as silent.
    case 'PreToolUse':
      return { sitzung, ereignis: 'tool', cwd };
    default:
      return null;
  }
}

function modifiedAt(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

/** Takes the window before the post: tool calls overlap, and only one of them may report. */
function takeToolWindow(session) {
  const marker = markerPath(`${session}.tool`);
  const last = modifiedAt(marker);
  if (last !== null && Date.now() - last < TOOL_REPORT_EVERY_MS) return false;
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, '');
  return true;
}

async function main() {
  const input = await readInput();
  if (input === null) return;
  const body = eventBody(input);
  if (body === null) return;
  if (body.ereignis === 'tool' && !takeToolWindow(body.sitzung)) return;
  await post('/api/cockpit/ereignis', body, 2000);
}

if (runsAsHook(import.meta.url)) {
  main()
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
    });
}
