// Posts an approved review on a pull request. A command the reviewer runs, not a hook: it reports every
// failure and exits non-zero, so the session knows to fall back to a PR comment.
//
//   node .claude/hooks/cockpit/post-review.mjs <owner>/<repo> <n> <<'EOF'
//   {"event":"APPROVE","body":"…","comments":[{"path":"src/x.ts","line":42,"side":"RIGHT","body":"…"}]}
//   EOF

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './shared.mjs';

const EVENTS = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'];
const SIDES = ['RIGHT', 'LEFT'];
const MAX_RETRIES = 2;
export const EXIT_INVALID = 2;
export const EXIT_POST_A_COMMENT = 3;

export function parseTarget(repo, number) {
  if (
    typeof repo !== 'string' ||
    !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo) ||
    /\.\./.test(repo)
  ) {
    return 'The first argument is the repo as owner/repo.';
  }
  if (typeof number !== 'string' || !/^[1-9][0-9]{0,9}$/.test(number)) {
    return 'The second argument is the pull request number.';
  }
  return { repo, number: Number(number) };
}

const hasOnly = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function commentError(comment, i) {
  const at = `comments[${i}]`;
  if (!isPlainObject(comment) || !hasOnly(comment, ['path', 'line', 'side', 'body'])) {
    return `${at} holds exactly path, line, side and body.`;
  }
  if (!isText(comment.path)) return `${at}.path is the file's path in the repo.`;
  if (!Number.isInteger(comment.line) || comment.line < 1) return `${at}.line is a line number.`;
  if (!SIDES.includes(comment.side)) return `${at}.side is RIGHT (or LEFT for a removed line).`;
  if (!isText(comment.body)) return `${at}.body is the finding's text.`;
  return null;
}

export function parseReview(text) {
  let review;
  try {
    review = JSON.parse(text);
  } catch {
    return 'The review on stdin is no valid JSON.';
  }
  if (!isPlainObject(review) || !hasOnly(review, ['event', 'body', 'comments'])) {
    return 'The review holds exactly event, body and comments.';
  }
  if (!EVENTS.includes(review.event)) return `event is one of ${EVENTS.join(', ')}.`;
  if (!isText(review.body)) return 'body is the approved review text.';
  if (!Array.isArray(review.comments))
    return 'comments is a list, empty when no finding has a line.';
  for (const [i, comment] of review.comments.entries()) {
    const error = commentError(comment, i);
    if (error) return error;
  }
  return review;
}

export function reviewArgs(target) {
  return [
    'api',
    '--method',
    'POST',
    `repos/${target.repo}/pulls/${target.number}/reviews`,
    '--input',
    '-',
  ];
}

// GitHub answers 422 for both, with these phrases in its error list.
const refusedOwnPr = (text) => /HTTP 422/.test(text) && /own pull request/i.test(text);
const refusedLine = (text) =>
  /HTTP 422/.test(text) && /\b(line|position|path|diff)\b|could not be resolved/i.test(text);

function withLinesInBody(review) {
  const lines = review.comments.map((c) => `- ${c.path}:${c.line} — ${c.body}`);
  return { ...review, body: `${review.body}\n\nLine comments:\n${lines.join('\n')}`, comments: [] };
}

/** `send` posts one review and returns `{ ok: true }` or `{ ok: false, text }` with gh's output. */
export function postReview(target, review, send) {
  let current = review;
  const notes = [];
  for (let attempt = 0; ; attempt++) {
    const answer = send(current);
    if (answer.ok) {
      const how = notes.length > 0 ? ` (${notes.join('; ')})` : '';
      return {
        code: 0,
        message: `Posted as a ${current.event} review on #${target.number}${how}.`,
      };
    }
    const retryable =
      attempt < MAX_RETRIES &&
      ((refusedOwnPr(answer.text) && current.event !== 'COMMENT') ||
        (refusedLine(answer.text) && current.comments.length > 0));
    if (!retryable) {
      return {
        code: EXIT_POST_A_COMMENT,
        message: [
          `GitHub refused the review: ${answer.text.trim() || 'no answer'}`,
          `Post the approved draft as a PR comment instead: gh pr comment ${target.number} --body-file -`,
        ].join('\n'),
      };
    }
    if (refusedOwnPr(answer.text) && current.event !== 'COMMENT') {
      notes.push(`GitHub refused ${current.event} on the account's own pull request`);
      // A comment review carries no verdict of its own, so the body has to.
      current = {
        ...current,
        event: 'COMMENT',
        body: `Verdict: ${current.event}\n\n${current.body}`,
      };
    } else {
      notes.push('line comments outside the diff, so they are in the body');
      current = withLinesInBody(current);
    }
  }
}

function ghSend(target) {
  return (review) => {
    const run = spawnSync('gh', reviewArgs(target), {
      input: JSON.stringify(review),
      encoding: 'utf8',
      windowsHide: true,
    });
    if (run.error) return { ok: false, text: `gh did not run: ${run.error.message}` };
    return run.status === 0 ? { ok: true } : { ok: false, text: `${run.stderr}\n${run.stdout}` };
  };
}

function main() {
  const target = parseTarget(process.argv[2], process.argv[3]);
  const review = typeof target === 'string' ? null : parseReview(readFileSync(0, 'utf8'));
  const invalid = typeof target === 'string' ? target : typeof review === 'string' ? review : null;
  if (invalid !== null) {
    console.error(`${invalid} Nothing was posted.`);
    process.exitCode = EXIT_INVALID;
    return;
  }
  const outcome = postReview(target, review, ghSend(target));
  (outcome.code === 0 ? console.log : console.error)(outcome.message);
  process.exitCode = outcome.code;
}

if (isEntryPoint(import.meta.url)) main();
