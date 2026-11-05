import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURL_GRACE_MS = 1000;

export function baseUrl() {
  return process.env.COCKPIT_URL ?? 'https://routine-utt5l6k4qa-ez.a.run.app';
}

// The ID becomes the file name of the marker: anything but letters, digits, `_` and `-` would leave a path open.
export function validSession(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : null;
}

// In a fired session only the variable holds the id the routine stores; the hook input's differs.
export function sessionOf(input) {
  return validSession(process.env.CLAUDE_CODE_REMOTE_SESSION_ID ?? input.session_id);
}

export function markerPath(session) {
  return join(tmpdir(), 'claude-cockpit', session);
}

function parseCurlOutput(stdout) {
  const end = stdout.lastIndexOf('\n');
  return { status: Number(stdout.slice(end + 1)), text: stdout.slice(0, end) };
}

// curl and not `fetch`: a network secret reaches curl only, and without it the routine answers 401.
function curl(url, args, stdin, timeoutMs) {
  // `--max-time 0` would mean no limit at all.
  if (timeoutMs <= 0) return Promise.resolve(null);
  return new Promise((done) => {
    const child = execFile(
      'curl',
      ['-s', '--max-time', String(timeoutMs / 1000), '-w', '\n%{http_code}', ...args, url],
      { timeout: timeoutMs + CURL_GRACE_MS, windowsHide: true },
      (error, stdout) => done(error ? null : parseCurlOutput(stdout)),
    );
    // Without curl the pipe breaks as well, and an unhandled `error` would end the hook loudly.
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}

/** `null`: no answer, for whatever reason. The body goes through stdin, argv would mangle umlauts on Windows. */
export function post(path, body, timeoutMs) {
  const headers = ['-H', 'Content-Type: application/json; charset=utf-8'];
  const args = [...headers, '--data-binary', '@-'];
  return curl(new URL(path, baseUrl()).href, args, JSON.stringify(body), timeoutMs);
}

/** `null`: no answer, for whatever reason. */
export function get(path, query, timeoutMs) {
  const url = new URL(path, baseUrl());
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return curl(url.href, [], '', timeoutMs);
}

const NUDGE_TIMEOUT_MS = 1500;
const NUDGE_HEADER = 'Nudges from the manager (act on them):';

/** Each nudge comes once: the routine marks it fetched. Every failure answers `[]`, a hook must never hold a session. */
export async function fetchNudges(session, timeoutMs = NUDGE_TIMEOUT_MS) {
  try {
    const timeout = Math.min(NUDGE_TIMEOUT_MS, timeoutMs);
    const answer = await get(`/api/cockpit/session/${session}/nudges`, {}, timeout);
    if (answer?.status !== 200) return [];
    const nudges = JSON.parse(answer.text)?.nudges;
    if (!Array.isArray(nudges)) return [];
    return nudges
      .filter((n) => typeof n?.id === 'number' && typeof n.text === 'string')
      .map(({ id, text }) => ({ id, text }));
  } catch {
    return [];
  }
}

/** `null` without nudges. */
export function nudgeText(nudges) {
  if (nudges.length === 0) return null;
  return [NUDGE_HEADER, ...nudges.map((n) => `- ${n.text}`)].join('\n');
}

export async function readInput() {
  try {
    process.stdin.setEncoding('utf8');
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const value = JSON.parse(text);
    return typeof value === 'object' && value !== null ? value : null;
  } catch {
    return null;
  }
}

// A plugin folder reached through a symlink gives the module its real path but `argv` the linked one.
function samePath(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

export function isEntryPoint(metaUrl) {
  return process.argv[1] !== undefined && samePath(fileURLToPath(metaUrl), process.argv[1]);
}

// The plugin on the claude.ai account reaches every session, also one whose repo brings the cockpit files itself.
// Its hooks sit in `<plugin>/skills/cockpit/hooks/`; a user-level copy reports to another routine and stays on.
export function yieldsToRepoCopy(metaUrl, projectDir) {
  if (typeof projectDir !== 'string' || projectDir === '') return false;
  const own = dirname(fileURLToPath(metaUrl));
  const fromPlugin = existsSync(join(own, '..', '..', '..', '.claude-plugin', 'plugin.json'));
  return fromPlugin && existsSync(join(projectDir, '.claude', 'hooks', 'cockpit', 'shared.mjs'));
}

/** Run as a hook, and not a plugin copy standing aside for the repo's own hooks. */
export function runsAsHook(metaUrl) {
  return (
    isEntryPoint(metaUrl) &&
    !yieldsToRepoCopy(metaUrl, process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
  );
}
