import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import {
  fetchNudges,
  get,
  isEntryPoint,
  markerPath,
  nudgeText,
  post,
  readInput,
  sessionOf,
} from './shared.mjs';

const DEADLINE_MS = 4500;
const REPORT_TIMEOUT_MS = 2000;
const GIT_TIMEOUT_MS = 1000;
const REQUESTS_MIN_MS = 500;

// From the process start: the `timeout: 5` this hook registers with counts Node's boot as well.
const timeLeft = () => Math.floor(DEADLINE_MS - performance.now());

const GITHUB_KEY = String.raw`[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9._-]+#\d+`;
const JIRA_KEY = String.raw`[A-Z][A-Z0-9]+-\d+`;
const ROLES = 'spec-author|planner|implementierer|reviewer|tester|end-to-end';

// The payload's lines arrive indented inside `<routine-fire-payload>`, and the saved prompt around them is free text.
const payloadLine = (name, value) => new RegExp(String.raw`^\s*${name}:\s*(${value})\s*$`, 'm');
const TICKET_LINE = payloadLine('ticket', `${GITHUB_KEY}|${JIRA_KEY}`);
const ROLE_LINE = payloadLine('role', ROLES);
const WORK_ITEM_LINE = payloadLine('work item', String.raw`\d+`);
// No `\b`: `_` counts as a word character, so `ABC-12_review` would find nothing.
const TICKET_IN_BRANCH = new RegExp(
  String.raw`(?<![\w/.-])${GITHUB_KEY}(?!\w)|(?<![A-Za-z0-9])${JIRA_KEY}(?![A-Za-z0-9])`,
);

function payloadValue(line, prompt) {
  return typeof prompt === 'string' ? (line.exec(prompt)?.[1] ?? null) : null;
}

export function findTicket(prompt, branch) {
  const ticket = payloadValue(TICKET_LINE, prompt);
  if (ticket !== null) return ticket;
  return typeof branch === 'string' ? (TICKET_IN_BRANCH.exec(branch)?.[0] ?? null) : null;
}

export function findRole(prompt) {
  return payloadValue(ROLE_LINE, prompt);
}

export function findWorkItem(prompt) {
  const id = payloadValue(WORK_ITEM_LINE, prompt);
  return id === null ? null : Number(id);
}

export function repoName(cwd, commonDir) {
  return commonDir ? basename(dirname(commonDir)) : basename(cwd);
}

function contextText(ticket, session, markdown) {
  const header =
    `Cockpit-Kontext zu ${ticket}, vom Hook geholt. Deine Sitzung: \`${session}\` — ` +
    'gib sie beim Anlegen der Arbeit als `sitzung` mit. Den Kontext nicht noch einmal abrufen.';
  return `${header}\n\n${markdown}`;
}

function hookOutput(additionalContext) {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext },
  });
}

export function buildOutput(ticket, session, markdown) {
  return hookOutput(contextText(ticket, session, markdown));
}

async function fetchRequestSection(ticket, role, timeoutMs) {
  const query = role ? { ticket, rolle: role } : { ticket };
  const answer = await get('/api/cockpit/request/context', query, timeoutMs);
  return answer?.status === 200 ? answer.text : '';
}

/** `null`: no context. Requests are not part of `/kontext`: they live with the handover points. */
// `rolle` picks this role's handoff note; `sitzung` lets the routine see a predecessor that never ended.
export async function fetchContext(ticket, repo, role, session, left) {
  const query = { ticket, repo };
  if (role !== null) query.rolle = role;
  if (session !== null) query.sitzung = session;
  const answer = await get('/api/cockpit/kontext', query, left());
  if (answer?.status !== 200) return null;
  if (left() < REQUESTS_MIN_MS) return answer.text;
  const requests = await fetchRequestSection(ticket, role, left());
  return requests === '' ? answer.text : `${answer.text}\n\n${requests}`;
}

function git(cwd, args) {
  const timeout = Math.min(GIT_TIMEOUT_MS, timeLeft());
  // `timeout: 0` would mean no limit at all.
  if (timeout <= 0) return null;
  try {
    const out = execFileSync('git', args, {
      cwd,
      timeout,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    return out === '' ? null : out;
  } catch {
    return null;
  }
}

function dirOrHere(value) {
  try {
    return typeof value === 'string' && statSync(value).isDirectory() ? value : process.cwd();
  } catch {
    return process.cwd();
  }
}

/** `null`: no context, because the session had it already, names no ticket, or the routine did not give it. */
async function firstContext(input, session) {
  const marker = markerPath(session);
  if (existsSync(marker)) return null;
  const cwd = dirOrHere(input.cwd);

  const ticket =
    findTicket(input.prompt, null) ??
    findTicket(null, git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']));
  if (ticket === null) return null;

  const repo = repoName(cwd, git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const context = await fetchContext(ticket, repo, findRole(input.prompt), session, timeLeft);
  if (context === null) return null;

  // Marker first, and if it throws, no context: otherwise the same context would come back with
  // every prompt, each time as a new delivery.
  try {
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, '');
  } catch {
    return null;
  }
  return contextText(ticket, session, context);
}

async function main() {
  const input = await readInput();
  if (input === null) return;
  const session = sessionOf(input);
  if (session === null) return;
  const workItem = findWorkItem(input.prompt);
  if (workItem !== null) {
    const timeout = Math.min(REPORT_TIMEOUT_MS, timeLeft());
    await post(`/api/cockpit/arbeit/${workItem}/report`, { sitzung: session }, timeout);
  }
  const nudges = nudgeText(await fetchNudges(session, timeLeft()));
  const context = await firstContext(input, session).catch(() => null);
  const parts = [nudges, context].filter((part) => part !== null);
  if (parts.length > 0) process.stdout.write(hookOutput(parts.join('\n\n')));
}

// Never `process.exit()`: on a pipe under Linux, output not yet written would be lost.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
    });
}
