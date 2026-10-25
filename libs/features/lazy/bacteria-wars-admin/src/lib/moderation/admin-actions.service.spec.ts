import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { AdminAccessService } from '../access/admin-access.service';
import {
  type AdminResult,
  AdminCommandsService,
} from '../commands/admin-commands.service';
import { AdminActionsService } from './admin-actions.service';

function setUp(confirmed: unknown, result: AdminResult | Error) {
  const action = new Subject<void>();
  const snackBar = {
    open: jest.fn(() => ({ onAction: () => action })),
  };
  const send = jest.fn(async () => {
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
  const sendReplay = jest.fn(async () => result as AdminResult);
  const signIn = jest.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MatDialog,
        useValue: { open: () => ({ afterClosed: () => of(confirmed) }) },
      },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: AdminCommandsService, useValue: { send, sendReplay } },
      { provide: AdminAccessService, useValue: { signIn } },
    ],
  });
  return {
    service: TestBed.inject(AdminActionsService),
    snackBar,
    send,
    sendReplay,
    signIn,
    action,
  };
}

const ban = {
  type: 'player.ban' as const,
  subject: 'Ada',
  ban: true,
  target: { uid: 'ada' },
};

describe('AdminActionsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sends nothing when the owner cancels', async () => {
    const { service, send } = setUp(undefined, { ok: true });
    expect(await service.run(ban)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the command with the reason and arguments confirmed', async () => {
    const { service, send, snackBar } = setUp(
      { reason: 'aimbot', args: { until: null, reason: 'cheating' } },
      { ok: true }
    );
    expect(await service.run(ban)).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({
      type: 'player.ban',
      target: { uid: 'ada' },
      reason: 'aimbot',
      args: { until: null, reason: 'cheating' },
    });
    expect(snackBar.open).toHaveBeenLastCalledWith('Done.', undefined, {
      duration: 4000,
    });
  });

  it('offers a fresh sign-in when the command needs one', async () => {
    const { service, snackBar, signIn, action } = setUp(
      { reason: 'x', args: {} },
      { ok: false, error: 'sign-in-again' }
    );
    await service.run(ban);
    expect(snackBar.open).toHaveBeenLastCalledWith(
      expect.stringContaining('within the last hour'),
      'Sign in with Google'
    );
    action.next();
    expect(signIn).toHaveBeenCalled();
  });

  it('tells a refusal, and a failure to send', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {
      // expected
    });
    const refused = setUp(
      { reason: 'x', args: {} },
      {
        ok: false,
        error: 'not-found',
      }
    );
    await refused.service.run(ban);
    expect(refused.snackBar.open).toHaveBeenLastCalledWith(
      'The server refused: not-found',
      undefined,
      { duration: 8000 }
    );

    TestBed.resetTestingModule();
    const failed = setUp({ reason: 'x', args: {} }, new Error('offline'));
    expect(await failed.service.run(ban)).toEqual({
      ok: false,
      error: 'internal',
    });
    error.mockRestore();
  });

  it('runs a gallery curation through the same dialog and snack bar', async () => {
    const { service, send, sendReplay, snackBar } = setUp(
      { reason: '', args: {} },
      { ok: true }
    );
    expect(await service.runReplay('feature', 'r1', 'r1')).toEqual({
      ok: true,
    });
    expect(sendReplay).toHaveBeenCalledWith('feature', 'r1');
    expect(send).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenLastCalledWith('Done.', undefined, {
      duration: 4000,
    });
  });
});
