import {
  COMMAND_ENVELOPE_KEYS,
  COMMAND_TTL_MS,
  CURATION_COMMAND_TYPES,
  hasOnlyCommandKeys,
  parseCommandResult,
  parseReplayCommand,
  PLAYER_REPLAY_COMMAND_TYPES,
  REPLAY_COMMAND_TYPES,
} from './command-documents';

describe('command documents', () => {
  describe('the envelope', () => {
    it('names the fields every command document carries', () => {
      expect(COMMAND_ENVELOPE_KEYS).toEqual(['uid', 'createdAt', 'expireAt']);
    });

    it('expires a day after the write, inside the rules’ two days', () => {
      expect(COMMAND_TTL_MS).toBe(24 * 60 * 60 * 1000);
      expect(COMMAND_TTL_MS).toBeLessThan(2 * 24 * 60 * 60 * 1000);
    });

    it('takes only the command’s keys besides the envelope and result', () => {
      const stored = { uid: 'a', createdAt: 1, expireAt: 2, result: {} };
      expect(hasOnlyCommandKeys({ ...stored, type: 'x' }, ['type'])).toBe(true);
      expect(hasOnlyCommandKeys({ ...stored, extra: 1 }, ['type'])).toBe(false);
      // Only `forget` claims its command, and never on what the trigger reads.
      expect(hasOnlyCommandKeys({ claimed: true }, ['type'])).toBe(false);
    });
  });

  describe('replay commands', () => {
    it('splits the types into the player’s and the owner’s curation', () => {
      expect([
        ...PLAYER_REPLAY_COMMAND_TYPES,
        ...CURATION_COMMAND_TYPES,
      ]).toEqual([...REPLAY_COMMAND_TYPES]);
      expect(PLAYER_REPLAY_COMMAND_TYPES).toEqual(['remove', 'forget']);
      expect(CURATION_COMMAND_TYPES).toEqual([
        'feature',
        'unfeature',
        'anonymise',
      ]);
    });

    it.each(REPLAY_COMMAND_TYPES)('reads %s with its envelope', (type) => {
      expect(
        parseReplayCommand({
          uid: 'ada',
          type,
          replayId: 'l_a-1',
          createdAt: {},
          expireAt: {},
          result: { ok: true },
        })
      ).toEqual({ type, replayId: 'l_a-1' });
    });

    it.each<[string, unknown]>([
      ['no object', null],
      ['an unknown type', { type: 'delete', replayId: 'r1' }],
      ['no replay id', { type: 'remove' }],
      ['a replay id the rules refuse', { type: 'remove', replayId: 'a/b' }],
      ['a replay id too long', { type: 'remove', replayId: 'a'.repeat(65) }],
      ['an extra field', { type: 'remove', replayId: 'r1', extra: true }],
    ])('refuses %s', (_, value) => {
      expect(parseReplayCommand(value)).toBeNull();
    });
  });

  describe('the result', () => {
    it('reads a success and a failure with its error', () => {
      expect(parseCommandResult({ ok: true, at: {} })).toEqual({ ok: true });
      expect(parseCommandResult({ ok: false, error: 'ranking' })).toEqual({
        ok: false,
        error: 'ranking',
      });
    });

    it('leaves out an error that is no id', () => {
      expect(parseCommandResult({ ok: false, error: 3 })).toEqual({
        ok: false,
      });
    });

    it.each<[string, unknown]>([
      ['none', undefined],
      ['no object', 'ok'],
      ['no ok', { error: 'internal' }],
    ])('reads nothing from %s', (_, value) => {
      expect(parseCommandResult(value)).toBeNull();
    });
  });
});
