import {
  SELECTION_KEY,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import {
  SignInCancelled,
  AccountSwitched,
  AccountNotDeleted,
  NotAllSent,
  Offline,
} from './account-service';
import { AccountSession } from './account-session';
import {
  FakeAccountService,
  FakeFlag,
  MIMI_PARENT,
} from './testing/fake-account-service';

interface Setup {
  readonly session: AccountSession;
  readonly service: FakeAccountService;
  readonly local: LocalSelection;
  readonly flag: FakeFlag;
  readonly loaded: () => number;
  online: boolean;
}

async function setUp(
  options: {
    wasSignedIn?: boolean;
    withoutSignIn?: boolean;
    service?: FakeAccountService;
    local?: LocalSelection;
  } = {}
): Promise<Setup> {
  const service = options.service ?? new FakeAccountService();
  const local = options.local ?? new LocalSelection(undefined);
  const flag = new FakeFlag(options.wasSignedIn);
  let loads = 0;
  const load = async () => {
    loads++;
    return service;
  };
  const setup: Omit<Setup, 'session'> & { session?: AccountSession } = {
    service,
    local,
    flag,
    loaded: () => loads,
    online: true,
  };
  const session = new AccountSession(
    local,
    options.withoutSignIn ? undefined : load,
    flag,
    () => setup.online
  );
  setup.session = session;
  await session.start();
  return setup as Setup;
}

/** Signed in, with Meine Teams and a Kind chosen on the device before. */
async function signedIn(): Promise<Setup> {
  const setup = await setUp();
  await setup.local.follow(313036);
  await setup.local.mark({ kind: 'named', personId: 4711 }, 'Mimi');
  await setup.session.signIn();
  setup.service.calls.length = 0;
  return setup;
}

/** Lets the promises a callback started settle. */
const settle = () => new Promise((proceed) => setTimeout(proceed));

const SIGNED_IN = { kind: 'signed-in', name: 'Familie Muster' } as const;

describe('AccountSession', () => {
  describe('at start', () => {
    it('offers no account and loads nothing where the build has no sign-in', async () => {
      const { session, local, loaded } = await setUp({
        withoutSignIn: true,
      });
      await local.follow(313036);

      expect(session.state()).toEqual({ kind: 'off' });
      expect(session.selection.teams()).toEqual([313036]);
      expect(loaded()).toBe(0);
    });

    it('keeps an Elternteil never signed in on the device, without loading Firebase', async () => {
      const { session, local, loaded } = await setUp();
      await local.follow(313036);

      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(session.selection.teams()).toEqual([313036]);
      expect(session.selection.unreadable()).toBe(false);
      expect(loaded()).toBe(0);
    });

    it('opens the account of an Elternteil signed in before', async () => {
      const service = new FakeAccountService();
      service.restored = MIMI_PARENT;

      const { session } = await setUp({ wasSignedIn: true, service });

      expect(session.state()).toEqual(SIGNED_IN);
      expect(service.calls).toEqual(['signedIn', 'selection uid-1']);
    });

    it('goes back to the device where Auth holds the Elternteil no longer, its cache cleared first', async () => {
      const { session, flag, service } = await setUp({
        wasSignedIn: true,
      });

      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(flag.isSet()).toBe(false);
      expect(service.calls).toEqual(['signedIn', 'clearCache']);
    });

    it("says it cannot read, and shows no device's choices, while the account cannot be opened", async () => {
      const session = new AccountSession(
        new LocalSelection(undefined),
        () => Promise.reject(new Error('offline')),
        new FakeFlag(true)
      );

      await session.start();

      expect(session.state()).toEqual({ kind: 'unreachable' });
      expect(session.selection.teams()).toBeUndefined();
      expect(session.selection.unreadable()).toBe(true);
    });
  });

  it("names another store once the account's holds the choices, and the device's again after signing out", async () => {
    const { session } = await setUp();
    const device = session.selection.source();

    await session.signIn();
    const account = session.selection.source();
    expect(account).toBeDefined();
    expect(account).not.toBe(device);

    await session.signOut();
    expect(session.selection.source()).toBe(device);
  });

  describe('getting ready', () => {
    it('is ready for the click once Firebase is loaded', async () => {
      const { session } = await setUp();
      expect(session.ready()).toBe(false);

      await session.prepare();

      expect(session.ready()).toBe(true);
    });

    it('loads Firebase once, ahead of the click', async () => {
      const { session, loaded } = await setUp();

      await session.prepare();
      await session.prepare();
      await session.signIn();

      expect(loaded()).toBe(1);
    });
  });

  describe('signing in', () => {
    it("takes the device's choices into the account, then off the device", async () => {
      const { session, service, local, flag } = await setUp();
      await local.follow(313036);
      await local.mark({ kind: 'named', personId: 4711 }, 'Mimi');

      await session.signIn();

      expect(service.calls).toEqual([
        'signInWithGoogle',
        'takeOverDevice uid-1',
        'selection uid-1',
      ]);
      expect(service.takenOver).toEqual({
        teams: [313036],
        children: [{ personId: 4711, nickname: 'Mimi' }],
        clubColors: [],
      });
      expect(local.teams()).toEqual([]);
      expect(flag.isSet()).toBe(true);
      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('tells what did not fit into the account', async () => {
      const service = new FakeAccountService();
      service.leftOver = {
        teams: [9001, 9002],
        children: [{ personId: 4711 }],
        clubColors: [],
      };
      const { session } = await setUp({ service });

      expect(await session.signIn()).toEqual({
        teams: [9001, 9002],
        children: [{ personId: 4711 }],
        clubColors: [],
      });
      expect(session.takeoverHint()).toEqual({
        leftOver: {
          teams: [9001, 9002],
          children: [{ personId: 4711 }],
          clubColors: [],
        },
        kept: false,
      });
    });

    it("keeps the device's choices that did not fit on the device, and tells again at the next start", async () => {
      const service = new FakeAccountService();
      const local = new LocalSelection(undefined);
      await local.follow(313036);
      await local.follow(9001);
      service.leftOver = { teams: [9001], children: [], clubColors: [] };
      const { session } = await setUp({ service, local });

      await session.signIn();

      expect(local.teams()).toEqual([9001]);
      expect(session.takeoverHint()?.leftOver.teams).toEqual([9001]);
      expect(session.takeoverHint()?.kept).toBe(false);

      const fresh = await setUp({ service, local, wasSignedIn: true });
      expect(fresh.session.takeoverHint()?.leftOver.teams).toEqual([9001]);
    });

    it("drops the takeover's notice once another tab switched to another account", async () => {
      const service = new FakeAccountService();
      service.leftOver = { teams: [9001], children: [], clubColors: [] };
      const { session } = await setUp({ service });
      await session.signIn();

      service.authReports({ uid: 'uid-2', name: 'Familie Beispiel' });
      await settle();

      expect(session.takeoverHint()).toBeUndefined();
    });

    it("shows the account's choices once signed in", async () => {
      const { session, service } = await signedIn();

      expect(session.selection.teams()).toBe(service.accountSelection.teams());
    });

    it('changes nothing when the popup was closed', async () => {
      const { session, service, local, flag } = await setUp();
      await local.follow(313036);
      service.cancelled = true;

      await expect(session.signIn()).rejects.toBeInstanceOf(SignInCancelled);

      expect(service.calls).toEqual(['signInWithGoogle']);
      expect(local.teams()).toEqual([313036]);
      expect(flag.isSet()).toBe(false);
      expect(session.state()).toEqual({ kind: 'signed-out' });
    });

    it("signs out again, the device's choices kept, where they could not be taken over", async () => {
      const { session, service, local, flag } = await setUp();
      await local.follow(313036);
      service.takeoverFails = true;

      await expect(session.signIn()).rejects.toThrow('offline');

      expect(service.calls).toEqual([
        'signInWithGoogle',
        'takeOverDevice uid-1',
        'signOut',
        'clearCache',
      ]);
      expect(local.teams()).toEqual([313036]);
      expect(flag.isSet()).toBe(false);
      expect(session.state()).toEqual({ kind: 'signed-out' });
    });

    it('takes over what changed on the device while it took over', async () => {
      const { session, service, local } = await setUp();
      await local.follow(313036);
      service.duringTakeover = () => local.follow(201500);

      await session.signIn();

      expect(service.calls).toEqual([
        'signInWithGoogle',
        'takeOverDevice uid-1',
        'takeOverDevice uid-1',
        'selection uid-1',
      ]);
      // the second round takes what joined; the first took the rest
      expect(service.takenOver?.teams).toEqual([201500]);
      expect(local.teams()).toEqual([]);
    });

    it("keeps the device's choices where they changed during every takeover", async () => {
      const { session, service, local } = await setUp();
      let team = 900000;
      service.onEveryTakeover = () => local.follow(team++);

      await session.signIn();

      expect(session.takeoverHint()?.kept).toBe(true);
      expect(local.teams()?.length).toBeGreaterThan(0);
      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('keeps choices a takeover kept on the device when signing out before the next start', async () => {
      const { session, service, local } = await setUp();
      let team = 900000;
      service.onEveryTakeover = () => local.follow(team++);
      await session.signIn();
      service.onEveryTakeover = undefined;
      const kept = local.teams();

      await session.signOut();

      expect(local.teams()).toEqual(kept);
      expect(session.selection.teams()).toEqual(kept);
    });

    it('takes off the device only what it took over, so a Kind renamed meanwhile goes over next', async () => {
      const { session, service, local } = await setUp();
      await local.follow(313036);
      await local.mark({ kind: 'named', personId: 4711 }, 'Mimi');
      const takenOver: unknown[] = [];
      service.onEveryTakeover = async () => {
        takenOver.push(service.takenOver);
        if (takenOver.length === 1) {
          await local.setNickname(4711, 'Mi');
        }
      };

      await session.signIn();

      expect(service.takenOver).toEqual({
        teams: [],
        children: [{ personId: 4711, nickname: 'Mi' }],
        clubColors: [],
      });
      expect(local.children()).toEqual([]);
      expect(session.takeoverHint()?.kept).toBe(false);
    });

    it('takes over what another tab stored meanwhile, before its storage event', async () => {
      const storage = new Map<string, string>();
      const device = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      };
      const local = new LocalSelection(device);
      const service = new FakeAccountService();
      const { session } = await setUp({ service, local });
      await local.follow(313036);
      service.duringTakeover = async () => {
        // another tab, its storage event not here yet
        storage.set(
          SELECTION_KEY,
          JSON.stringify({ version: 3, teams: { 313036: 1, 201500: 2 } })
        );
      };

      await session.signIn();

      // the second round takes what joined; the first took the rest
      expect(service.takenOver?.teams).toEqual([201500]);
      expect(session.takeoverHint()?.kept).toBe(false);
      expect(local.teams()).toEqual([]);
    });

    it('takes the kept choices over at the next start', async () => {
      const service = new FakeAccountService();
      service.restored = MIMI_PARENT;
      const local = new LocalSelection(undefined);
      await local.follow(201500);

      const { session } = await setUp({
        wasSignedIn: true,
        service,
        local,
      });

      expect(service.takenOver?.teams).toEqual([201500]);
      expect(local.teams()).toEqual([]);
      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('keeps the account open, and the kept choices, where taking them over at the start fails', async () => {
      const service = new FakeAccountService();
      service.restored = MIMI_PARENT;
      service.takeoverFails = true;
      const local = new LocalSelection(undefined);
      await local.follow(201500);

      const { session } = await setUp({
        wasSignedIn: true,
        service,
        local,
      });

      expect(session.state()).toEqual(SIGNED_IN);
      expect(session.selection.unreadable()).toBe(false);
      expect(session.takeoverHint()?.kept).toBe(true);
      expect(local.teams()).toEqual([201500]);
    });

    it('runs one sign-in at a time: a second click joins the first', async () => {
      const { session, service } = await setUp();

      await Promise.all([session.signIn(), session.signIn()]);

      expect(
        service.calls.filter((call) => call === 'signInWithGoogle')
      ).toHaveLength(1);
    });

    it("reports the takeover's failure even where signing out again fails too", async () => {
      const { session, service } = await setUp();
      service.takeoverFails = true;
      service.signOutFails = true;

      await expect(session.signIn()).rejects.toThrow('offline');
    });
  });

  describe('signing out', () => {
    it("signs out first, then takes the account's choices off the device", async () => {
      const { session, service, local, flag } = await signedIn();

      await session.signOut();

      expect(service.calls).toEqual([
        'allSent',
        'signOut',
        'stop',
        'clearCache',
      ]);
      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(session.selection.teams()).toEqual([]);
      expect(local.children()).toEqual([]);
      expect(flag.isSet()).toBe(false);
    });

    it('refuses while changes have not reached the account, nothing changed', async () => {
      const { session, service, flag } = await signedIn();
      service.notSent = true;

      await expect(session.signOut()).rejects.toBeInstanceOf(NotAllSent);

      expect(service.calls).toEqual(['allSent']);
      expect(session.state()).toEqual(SIGNED_IN);
      expect(flag.isSet()).toBe(true);
    });

    it('stays signed in, the account open, where Auth does not sign out', async () => {
      const { session, service, flag } = await signedIn();
      service.signOutFails = true;

      await expect(session.signOut()).rejects.toThrow('Auth unreachable');

      expect(service.calls).toEqual(['allSent', 'signOut']);
      expect(session.state()).toEqual(SIGNED_IN);
      expect(session.selection.teams()).toBe(service.accountSelection.teams());
      expect(flag.isSet()).toBe(true);
    });
  });

  describe('deleting the account', () => {
    it("deletes nothing where another tab switched the account during Google's question", async () => {
      const { session, service } = await signedIn();
      service.duringPopup = () => {
        service.restored = { uid: 'uid-2', name: 'Familie Beispiel' };
      };

      await expect(session.deleteAccount()).rejects.toBeInstanceOf(
        AccountSwitched
      );

      expect(service.calls).not.toContain('deleteSelection uid-1');
      expect(service.calls.some((a) => a.startsWith('deleteAuthUser'))).toBe(
        false
      );
    });

    it('deletes the account it asked Google about, by its uid', async () => {
      const { session, service } = await signedIn();

      await session.deleteAccount();

      expect(service.calls).toContain('deleteAuthUser uid-1');
    });

    it('says the account is still there where Auth refuses it after its document went', async () => {
      const { session, service } = await signedIn();
      service.deleteAuthUserFails = true;

      await expect(session.deleteAccount()).rejects.toBeInstanceOf(
        AccountNotDeleted
      );

      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('is refused while the start takes kept choices over', async () => {
      const service = new FakeAccountService();
      service.restored = MIMI_PARENT;
      const takeover = Promise.withResolvers<void>();
      service.duringTakeover = () => takeover.promise;
      const local = new LocalSelection(undefined);
      await local.follow(201500);
      const session = new AccountSession(
        local,
        async () => service,
        new FakeFlag(true)
      );
      const started = session.start();
      await settle();

      await expect(session.deleteAccount()).rejects.toThrow();

      takeover.resolve();
      await started;
      expect(service.calls).not.toContain('deleteSelection uid-1');
    });

    it('tells the step running, and the failure of the last one, to any page', async () => {
      const { session, service } = await signedIn();
      const confirmed = Promise.withResolvers<void>();
      service.deletionConfirmed = confirmed.promise;
      service.deleteAuthUserFails = true;

      const deletion = session.deleteAccount().catch(() => undefined);
      await settle();
      expect(session.running()).toBe('delete');

      confirmed.resolve();
      await deletion;
      expect(session.running()).toBeUndefined();
      expect(session.failure()?.kind).toBe('delete');
      expect(session.failure()?.error).toBeInstanceOf(AccountNotDeleted);

      service.deleteAuthUserFails = false;
      const secondAttempt = session.deleteAccount();
      expect(session.failure()).toBeUndefined();
      await secondAttempt;
    });

    it('asks Google first, then deletes the document, then the account', async () => {
      const { session, service, flag } = await signedIn();

      await session.deleteAccount();

      expect(service.calls).toEqual([
        'reauthenticate',
        'deleteSelection uid-1',
        'deleteAuthUser uid-1',
        'stop',
        'clearCache',
      ]);
      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(session.selection.teams()).toEqual([]);
      expect(flag.isSet()).toBe(false);
    });

    it('deletes nothing where the Elternteil cancels Google', async () => {
      const { session, service } = await signedIn();
      service.cancelled = true;

      await expect(session.deleteAccount()).rejects.toBeInstanceOf(
        SignInCancelled
      );

      expect(service.calls).toEqual(['reauthenticate']);
      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('deletes nothing offline', async () => {
      const setup = await signedIn();
      setup.online = false;

      await expect(setup.session.deleteAccount()).rejects.toBeInstanceOf(
        Offline
      );

      expect(setup.service.calls).toEqual([]);
      expect(setup.session.state()).toEqual(SIGNED_IN);
    });

    it('deletes the account only once the server confirmed its document gone, however long that takes', async () => {
      const { session, service } = await signedIn();
      const confirmed = Promise.withResolvers<void>();
      service.deletionConfirmed = confirmed.promise;

      const deletion = session.deleteAccount();
      await settle();
      expect(service.calls).toEqual([
        'reauthenticate',
        'deleteSelection uid-1',
      ]);
      expect(session.state()).toEqual(SIGNED_IN);

      confirmed.resolve();
      await deletion;
      expect(service.calls).toContain('deleteAuthUser uid-1');
      expect(session.state()).toEqual({ kind: 'signed-out' });
    });
  });

  describe('beside other tabs', () => {
    it('follows a sign-out in another tab', async () => {
      const { session, service, flag } = await signedIn();

      service.authReports(null);
      await settle();

      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(session.selection.teams()).toEqual([]);
      expect(flag.isSet()).toBe(false);
      expect(service.calls).toEqual(['stop', 'clearCache']);
    });

    it('switches to the account another tab signed in to instead', async () => {
      const { session, service } = await signedIn();

      await service.selectionOf('uid-2').follow(201765);
      service.authReports({ uid: 'uid-2', name: 'Familie Beispiel' });
      await settle();

      expect(service.calls).toEqual(['stop', 'selection uid-2']);
      expect(session.selection.teams()).toEqual([201765]);
      expect(session.state()).toEqual({
        kind: 'signed-in',
        name: 'Familie Beispiel',
      });
    });

    it('follows a sign-out another tab made while its own popup was open', async () => {
      const { session, service } = await signedIn();
      service.cancelled = true;
      service.duringPopup = () => {
        service.restored = null;
        service.authReports(null);
      };

      await expect(session.deleteAccount()).rejects.toBeInstanceOf(
        SignInCancelled
      );
      await settle();

      expect(session.state()).toEqual({ kind: 'signed-out' });
      expect(session.selection.teams()).toEqual([]);
    });

    it("shows nothing of the old account while the new one's opens", async () => {
      const { session, service } = await signedIn();
      const { promise, resolve } = Promise.withResolvers<void>();
      service.selectionReady = promise;

      service.authReports({ uid: 'uid-2', name: 'Familie Beispiel' });
      await settle();

      expect(session.selection.teams()).toBeUndefined();
      expect(session.state()).toEqual({ kind: 'loading' });
      resolve();
      await settle();
      expect(session.state()).toEqual({
        kind: 'signed-in',
        name: 'Familie Beispiel',
      });
    });

    it("keeps the device's choices when another tab's sign-in fails and signs out", async () => {
      const { session, service, local } = await setUp();
      await session.prepare();
      await local.follow(313036);

      // the other tab signs in, cannot take the choices over, signs out
      service.authReports(MIMI_PARENT);
      await settle();
      service.authReports(null);
      await settle();

      expect(local.teams()).toEqual([313036]);
      expect(session.selection.teams()).toEqual([313036]);
    });

    describe('while an account opens', () => {
      async function opening() {
        const setup = await setUp();
        await setup.session.prepare();
        const ready = Promise.withResolvers<void>();
        setup.service.selectionReady = ready.promise;
        const count = (call: string) =>
          setup.service.calls.filter((a) => a === call).length;
        return { ...setup, ready: ready.resolve, count };
      }

      it('shows nothing of it where another tab signed out meanwhile', async () => {
        const {
          session,
          service,
          ready: markReady,
          count: countCalls,
        } = await opening();
        service.authReports(MIMI_PARENT);
        await settle();

        service.authReports(null);
        markReady();
        await settle();

        expect(session.state()).toEqual({ kind: 'signed-out' });
        expect(session.selection.teams()).toEqual([]);
        expect(countCalls('stop')).toBe(countCalls('selection uid-1'));
      });

      it('shows the account another tab switched to meanwhile, the first closed', async () => {
        const {
          session,
          service,
          ready: markReady,
          count: countCalls,
        } = await opening();
        service.authReports(MIMI_PARENT);
        await settle();

        service.authReports({ uid: 'uid-2', name: 'Familie Beispiel' });
        markReady();
        await settle();

        expect(session.state()).toEqual({
          kind: 'signed-in',
          name: 'Familie Beispiel',
        });
        expect(countCalls('stop')).toBe(1);
      });

      it('opens it once where another tab tells twice, the other opening closed', async () => {
        const {
          session,
          service,
          flag,
          ready: markReady,
          count: countCalls,
        } = await opening();
        service.restored = MIMI_PARENT;

        flag.fromAnotherTab(true);
        flag.fromAnotherTab(true);
        await settle();
        markReady();
        await settle();

        expect(session.state()).toEqual(SIGNED_IN);
        expect(countCalls('selection uid-1') - countCalls('stop')).toBe(1);
      });
    });

    it('follows a sign-in in another tab, once Firebase is loaded here', async () => {
      const { session, service } = await setUp();
      await session.prepare();

      service.authReports(MIMI_PARENT);
      await settle();

      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('opens the account another tab signed in to, before Firebase is loaded here', async () => {
      const service = new FakeAccountService();
      const { session, flag, loaded } = await setUp({ service });
      expect(loaded()).toBe(0);
      service.restored = MIMI_PARENT;

      flag.fromAnotherTab(true);
      await settle();

      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('signs out where the account can no longer be read', async () => {
      const { session, service } = await signedIn();

      service.readError?.({ code: 'permission-denied' });
      await settle();

      expect(service.calls).toEqual(['signOut', 'stop', 'clearCache']);
      expect(session.state()).toEqual({ kind: 'signed-out' });
    });

    it('says it cannot read where the account fails otherwise, its choices unshown', async () => {
      const { session, service } = await signedIn();
      await service.accountSelection.follow(313036);
      expect(session.selection.teams()).toEqual([313036]);

      service.readError?.({ code: 'unavailable' });

      expect(session.state()).toEqual({ kind: 'unreachable' });
      expect(session.selection.unreadable()).toBe(true);
      expect(session.selection.teams()).toBeUndefined();
      expect(session.selection.children()).toBeUndefined();
      await expect(session.selection.follow(201500)).rejects.toThrow();
    });

    it("says it cannot open an account another tab signed in to, and tries again on Auth's next word", async () => {
      const { session, service } = await setUp();
      await session.prepare();
      service.selectionFails = true;

      service.authReports(MIMI_PARENT);
      await settle();
      expect(session.state()).toEqual({ kind: 'unreachable' });

      service.selectionFails = false;
      service.authReports(MIMI_PARENT);
      await settle();
      expect(session.state()).toEqual(SIGNED_IN);
    });

    it('lets a start that found nobody signed in give way to a sign-in in another tab meanwhile', async () => {
      const service = new FakeAccountService();
      const cleared = Promise.withResolvers<void>();
      service.cacheReady = cleared.promise;
      const flag = new FakeFlag(true);
      const session = new AccountSession(
        new LocalSelection(undefined),
        async () => service,
        flag
      );
      const started = session.start();
      await settle();

      service.authReports(MIMI_PARENT);
      await settle();
      cleared.resolve();
      await started;

      expect(session.state()).toEqual(SIGNED_IN);
      expect(flag.isSet()).toBe(true);
    });

    it('clears the cache a sign-out left at a start without anyone signed in', async () => {
      const flag = new FakeFlag(false);
      flag.cleanUp = true;
      const service = new FakeAccountService();
      const session = new AccountSession(
        new LocalSelection(undefined),
        async () => service,
        flag
      );

      await session.start();
      await settle();

      expect(service.calls).toEqual(['clearCache']);
      expect(session.state()).toEqual({ kind: 'signed-out' });
    });
  });
});
