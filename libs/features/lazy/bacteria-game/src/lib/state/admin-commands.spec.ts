import {
  ADMIN_COMMAND_TYPES,
  DESTRUCTIVE_COMMAND_TYPES,
  isReplayCommandType,
  parseAdminCommand,
  REPLAY_COMMAND_TYPES,
} from './admin-commands';

const UID = 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7c';
const ENTRY = { boardId: 'daily-2026-10-23', entryId: 'Xy7Qp2LmN0aBcDeFgHiJ' };

describe('admin commands', () => {
  it('reads every type in its valid shape', () => {
    const valid: unknown[] = [
      { type: 'profile.reset', target: { uid: UID }, reason: 'Slur', args: {} },
      {
        type: 'profile.removeImage',
        target: { uid: UID },
        reason: 'x',
        args: {},
      },
      { type: 'board.hideEntry', target: ENTRY, reason: 'Odd', args: {} },
      {
        type: 'board.hideEntry',
        target: ENTRY,
        reason: 'Odd',
        args: { bar: true },
      },
      { type: 'board.hidePlayer', target: { uid: UID }, reason: 'r', args: {} },
      {
        type: 'board.hidePlayer',
        target: ENTRY,
        reason: 'r',
        args: { bar: false },
      },
      { type: 'board.restore', target: ENTRY, reason: 'Mistake', args: {} },
      {
        type: 'board.restore',
        target: { uid: UID },
        reason: 'Mistake',
        args: {},
      },
      {
        type: 'board.verify',
        target: { boardId: 'endless', entryId: 'e1' },
        reason: 'Check',
        args: {},
      },
      {
        type: 'player.ban',
        target: { uid: UID },
        reason: 'Scripted runs',
        args: { until: Date.UTC(2026, 9, 30), reason: 'cheating' },
      },
      {
        type: 'player.ban',
        target: ENTRY,
        reason: 'Spam names',
        args: { until: null, reason: 'spam' },
      },
      {
        type: 'player.unban',
        target: { uid: UID },
        reason: 'Appeal',
        args: {},
      },
      { type: 'stats.refresh', target: null, args: {} },
      { type: 'stats.recount', target: null, reason: '', args: {} },
    ];

    for (const command of valid) {
      expect(parseAdminCommand(command)).not.toBeNull();
    }
    const types = new Set(
      valid.map((command) => parseAdminCommand(command)?.type)
    );
    expect(types).toEqual(new Set(ADMIN_COMMAND_TYPES));
  });

  it('keeps exactly the command, dropping the stored envelope', () => {
    expect(
      parseAdminCommand({
        uid: UID,
        type: 'board.hideEntry',
        target: ENTRY,
        reason: 'Odd',
        args: { bar: true },
        createdAt: { seconds: 1 },
        expireAt: { seconds: 2 },
        result: { ok: true },
      })
    ).toEqual({
      type: 'board.hideEntry',
      target: ENTRY,
      reason: 'Odd',
      args: { bar: true },
    });
    expect(
      parseAdminCommand({ type: 'stats.refresh', target: null, args: {} })
    ).toEqual({ type: 'stats.refresh', target: null, reason: '', args: {} });
  });

  it('reads a ban end from a Firestore Timestamp', () => {
    const until = {
      seconds: 1_800_000_000,
      toMillis(): number {
        return this.seconds * 1000;
      },
    };

    expect(
      parseAdminCommand({
        type: 'player.ban',
        target: { uid: UID },
        reason: 'r',
        args: { until, reason: 'other' },
      })?.args
    ).toEqual({ until: 1_800_000_000_000, reason: 'other' });
  });

  it('refuses unknown types and anything not an object', () => {
    for (const value of [
      null,
      'profile.reset',
      [],
      { type: 'profile.delete', target: { uid: UID }, reason: 'r', args: {} },
      { type: 'feature', target: { uid: UID }, reason: 'r', args: {} },
      { target: { uid: UID }, reason: 'r', args: {} },
    ]) {
      expect(parseAdminCommand(value)).toBeNull();
    }
  });

  it('refuses extra or missing fields', () => {
    const base = {
      type: 'board.hideEntry',
      target: ENTRY,
      reason: 'Odd',
      args: {},
    };
    for (const value of [
      { ...base, extra: 1 },
      { ...base, args: { bar: true, more: 1 } },
      { ...base, target: { ...ENTRY, uid: UID } },
      { ...base, args: { bar: 'yes' } },
      { type: base.type, target: ENTRY, reason: 'Odd' },
      { type: base.type, reason: 'Odd', args: {} },
      { type: base.type, target: ENTRY, args: {} },
      { type: 'stats.refresh', args: {} },
      { type: 'stats.refresh', target: null, args: { all: true } },
      {
        type: 'player.ban',
        target: { uid: UID },
        reason: 'r',
        args: { reason: 'spam' },
      },
      {
        type: 'player.ban',
        target: { uid: UID },
        reason: 'r',
        args: { until: null },
      },
      {
        type: 'player.ban',
        target: { uid: UID },
        reason: 'r',
        args: { until: null, reason: 'rude' },
      },
      {
        type: 'player.ban',
        target: { uid: UID },
        reason: 'r',
        args: { until: -5, reason: 'spam' },
      },
      { ...base, uid: 'not a uid' },
    ]) {
      expect(parseAdminCommand(value)).toBeNull();
    }
  });

  it('refuses a missing, blank or long reason, but not on stats', () => {
    const base = { type: 'profile.reset', target: { uid: UID }, args: {} };

    expect(parseAdminCommand({ ...base, reason: '' })).toBeNull();
    expect(parseAdminCommand({ ...base, reason: '   ' })).toBeNull();
    expect(parseAdminCommand({ ...base, reason: 'x'.repeat(201) })).toBeNull();
    expect(
      parseAdminCommand({ ...base, reason: 'x'.repeat(200) })
    ).not.toBeNull();
    expect(parseAdminCommand({ ...base, reason: 7 })).toBeNull();
    expect(
      parseAdminCommand({
        type: 'stats.recount',
        target: null,
        reason: 'x'.repeat(201),
        args: {},
      })
    ).toBeNull();
  });

  it('refuses targets the type does not take', () => {
    for (const value of [
      { type: 'profile.reset', target: ENTRY, reason: 'r', args: {} },
      { type: 'player.unban', target: ENTRY, reason: 'r', args: {} },
      { type: 'board.hideEntry', target: { uid: UID }, reason: 'r', args: {} },
      { type: 'board.verify', target: { uid: UID }, reason: 'r', args: {} },
      // Only daily and endless entries are re-run.
      {
        type: 'board.verify',
        target: { boardId: 'xp', entryId: 'e1' },
        reason: 'r',
        args: {},
      },
      {
        type: 'board.hideEntry',
        target: { boardId: 'daily-2026-02-30', entryId: 'e1' },
        reason: 'r',
        args: {},
      },
      {
        type: 'board.hideEntry',
        target: { boardId: 'xp', entryId: 'a/b' },
        reason: 'r',
        args: {},
      },
      { type: 'profile.reset', target: { uid: '' }, reason: 'r', args: {} },
      { type: 'profile.reset', target: { uid: 'a/b' }, reason: 'r', args: {} },
      { type: 'profile.reset', target: null, reason: 'r', args: {} },
      { type: 'stats.refresh', target: { uid: UID }, args: {} },
    ]) {
      expect(parseAdminCommand(value)).toBeNull();
    }
  });

  it('names the destructive types', () => {
    expect([...DESTRUCTIVE_COMMAND_TYPES].sort()).toEqual([
      'board.hideEntry',
      'board.hidePlayer',
      'player.ban',
      'profile.removeImage',
      'profile.reset',
    ]);
  });

  describe('replay commands', () => {
    it('know the four types of ADR 0011 and nothing else', () => {
      expect(REPLAY_COMMAND_TYPES).toEqual([
        'remove',
        'feature',
        'unfeature',
        'anonymise',
      ]);
      expect(isReplayCommandType('remove')).toBe(true);
      expect(isReplayCommandType('delete')).toBe(false);
      expect(isReplayCommandType(undefined)).toBe(false);
    });
  });
});
