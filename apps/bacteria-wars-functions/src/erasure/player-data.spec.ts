import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAYER_DATA, type PlayerData, plainEntriesOf } from './player-data';

/**
 * The player data map (`PLAYER_DATA`) against the game's rules
 * (`apps/bacteria-game-remote/firestore.rules`, `database.rules.json`):
 * every path a client may reach has its entry, so a new collection keyed
 * by uid cannot ship without its erasing - or a reason it needs none.
 */
const RULES_DIR = join(__dirname, '../../../bacteria-game-remote');
const PREFIX = '/databases/{database}/documents';

/** Every `match` path of a rules file, nested ones joined, prefix dropped. */
function matchPaths(rules: string): string[] {
  // A comment starts a line or follows a blank; `//` in a string stays.
  const source = rules.replace(/(^|\s)\/\/.*$/gm, '$1');
  const stack: (string | null)[] = [];
  const paths: string[] = [];
  for (const token of source.matchAll(/match\s+(\/\S+)\s*\{|\{|\}/g)) {
    if (token[0] === '}') {
      stack.pop();
      continue;
    }
    const segment = token[1] ?? null;
    stack.push(segment);
    if (segment !== null) {
      const path = stack.filter((part) => part !== null).join('');
      if (path !== PREFIX) {
        paths.push(path.slice(PREFIX.length + 1));
      }
    }
  }
  return paths;
}

/** The path with its wildcards' names dropped. */
const shape = (path: string) => path.replace(/\{[^}]*\}/g, '{}');

/** The path with every wildcard but the player's unnamed. */
const playerShape = (path: string) => path.replace(/\{(?!uid\})[^}]*\}/g, '{}');

/** True when `path` is `above` or lies below it. */
const within = (path: string, above: string) =>
  path === above || path.startsWith(`${above}/`);

/** Has an entry: its own, or a `tree` above it. */
function covered(path: string, store: PlayerData['store']): boolean {
  const target = shape(path);
  return PLAYER_DATA.some(
    (entry) =>
      entry.store === store &&
      (shape(entry.path) === target ||
        (entry.erase === 'tree' && within(target, shape(entry.path))))
  );
}

describe('matchPaths', () => {
  it('joins nested matches and skips functions and comments, not URLs', () => {
    const rules = `service cloud.firestore {
      match /databases/{database}/documents {
        // match /commented/{id} {
        match /a/{uid} {
          allow read: if f({x: 1});
          match /b/{id} { allow read: if u == 'https://x'; }
        }
        function f(m) { return true; }
        match /c/{id=**} { allow read; }
      }
    }`;
    expect(matchPaths(rules)).toEqual([
      'a/{uid}',
      'a/{uid}/b/{id}',
      'c/{id=**}',
    ]);
  });
});

describe('the player data map', () => {
  const firestorePaths = matchPaths(
    readFileSync(join(RULES_DIR, 'firestore.rules'), 'utf8')
  );
  const realtimeNodes = Object.keys(
    (
      JSON.parse(
        readFileSync(join(RULES_DIR, 'database.rules.json'), 'utf8')
      ) as { rules: Record<string, unknown> }
    ).rules
  );

  it('reads the rules', () => {
    expect(firestorePaths).toContain('profiles/{uid}');
    expect(realtimeNodes).toContain('status');
  });

  it.each(firestorePaths)('has an entry for %s in Firestore', (path) => {
    expect(covered(path, 'firestore')).toBe(true);
  });

  it.each(realtimeNodes)(
    'has an entry for %s in the Realtime Database',
    (node) => {
      expect(
        PLAYER_DATA.some(
          (entry) =>
            entry.store === 'realtime' && entry.path.split('/')[0] === node
        )
      ).toBe(true);
    }
  );

  it('lists every path once', () => {
    const keys = PLAYER_DATA.map(
      (entry) => `${entry.store}:${shape(entry.path)}`
    );
    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  it('erases nothing twice: no entry lies below a tree', () => {
    expect(
      PLAYER_DATA.filter((entry) => {
        const own = playerShape(entry.path);
        return PLAYER_DATA.some(
          (tree) =>
            tree.erase === 'tree' &&
            tree.store === entry.store &&
            own !== playerShape(tree.path) &&
            within(own, playerShape(tree.path))
        );
      }).map((entry) => entry.path)
    ).toEqual([]);
  });

  it.each(
    PLAYER_DATA.filter(
      (entry) =>
        entry.erase === 'doc' ||
        entry.erase === 'tree' ||
        entry.erase === 'node'
    ).map((entry) => [entry.path, entry])
  )('names the player as the last segment of %s', (_, entry) => {
    expect(entry.path.split('/').at(-1)).toBe('{uid}');
  });

  it.each(
    PLAYER_DATA.filter((entry) => entry.erase === 'field').map((entry) => [
      entry.path,
      entry,
    ])
  )('erases %s by a field of a Firestore collection', (_, entry) => {
    expect(entry.store).toBe('firestore');
    expect(entry.path).toMatch(/^[A-Za-z]+\/\{[^}]+\}$/);
  });

  it('keeps Firestore paths to documents', () => {
    expect(
      PLAYER_DATA.filter(
        (entry) =>
          entry.store === 'firestore' && entry.path.split('/').length % 2 !== 0
      )
    ).toEqual([]);
  });

  it('gives each part its plain entries', () => {
    expect(plainEntriesOf('social').map((entry) => entry.path)).toEqual([
      'players/{uid}',
      'profiles/{uid}',
      'queue/{uid}',
      'invites/{token}',
      'status/{uid}',
      'connections/{uid}',
      'statusReaders/{uid}',
      'listedBy/{uid}',
    ]);
    expect(plainEntriesOf('account').map((entry) => entry.path)).toEqual([
      'boardMembers/{uid}',
      'endlessRuns/{runId}',
      'limits/{uid}',
      'moderation/{uid}',
    ]);
    expect(plainEntriesOf('replays').map((entry) => entry.path)).toEqual([
      'replaySubmissions/{id}',
      'replayCommands/{id}',
    ]);
  });
});
