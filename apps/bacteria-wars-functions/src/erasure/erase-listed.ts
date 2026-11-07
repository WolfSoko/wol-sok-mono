import { deleteAll, deleteRefs } from '../deletes';
import { settleAll } from '../settle';
import type { Stores } from './context';
import { type ByField, type ErasurePart, plainEntriesOf } from './player-data';

/**
 * Deletes what `PLAYER_DATA` lists of `part` by its path or a field alone
 * (`doc`, `tree`, `field`, `node`). The part's own code does its `custom`
 * entries and calls this where its order needs it; Realtime Database
 * paths it finds itself go as `alsoRemove`, in the same all-or-none update
 * as the listed nodes. Every delete runs, then the first failure is thrown. The number of documents it deleted, the
 * trees' not counted.
 */
export async function eraseListed(
  { db, realtime }: Stores,
  uid: string,
  part: ErasurePart,
  { alsoRemove = [] }: { alsoRemove?: readonly string[] } = {}
): Promise<number> {
  const entries = plainEntriesOf(part);
  const at = (path: string) => path.replace('{uid}', uid);
  const pathsOf = (kind: 'doc' | 'tree' | 'node') =>
    entries.filter((entry) => entry.erase === kind).map(({ path }) => at(path));
  const byField = entries.filter(
    (entry): entry is ByField => entry.erase === 'field'
  );
  const nodes = [...pathsOf('node'), ...alsoRemove];
  const [docs, fields] = await settleAll([
    deleteRefs(
      db,
      pathsOf('doc').map((path) => db.doc(path))
    ),
    settleAll(
      byField.map(({ path, field }) =>
        deleteAll(db, db.collection(path.split('/')[0]).where(field, '==', uid))
      )
    ),
    settleAll(pathsOf('tree').map((path) => db.recursiveDelete(db.doc(path)))),
    nodes.length === 0
      ? undefined
      : realtime.update(Object.fromEntries(nodes.map((path) => [path, null]))),
  ]);
  return fields.reduce((sum, count) => sum + count, docs);
}
