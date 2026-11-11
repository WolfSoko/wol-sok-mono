import { type Firestore } from 'firebase-admin/firestore';
import { kontoGeloescht } from '../konto-geloescht';
import { cleanUpOrphanedAccounts } from './orphaned-accounts';

jest.mock('../konto-geloescht', () => ({ kontoGeloescht: jest.fn() }));

/**
 * A Firestore that lists the given ids in every collection and deletes
 * whatever it is asked to (the legacy document after `kontoGeloescht`).
 */
const listing = (ids: readonly string[]) =>
  ({
    collection: () => ({
      listDocuments: async () => ids.map((id) => ({ id })),
      doc: () => ({ delete: async () => undefined }),
    }),
  }) as unknown as Firestore;

describe('cleanUpOrphanedAccounts, when a deletion fails', () => {
  it('goes on with the others and reports how far it got', async () => {
    jest
      .mocked(kontoGeloescht)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce();

    const report = await cleanUpOrphanedAccounts(
      listing(['living', 'a', 'b', 'c']),
      { missing: async (uids) => new Set(uids.filter((u) => u !== 'living')) },
      { deleteOrphans: true }
    );

    expect(kontoGeloescht).toHaveBeenCalledTimes(3);
    expect(report).toMatchObject({
      orphansFound: 3,
      orphansDeleted: 2,
    });
  });
});
