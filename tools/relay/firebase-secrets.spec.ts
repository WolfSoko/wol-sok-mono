import { describe, expect, it, jest } from '@jest/globals';
import { FirebaseSecrets, type Run } from './firebase-secrets';

describe('FirebaseSecrets', () => {
  it('reads the latest value of a secret of bacteria-wars', async () => {
    const run = jest.fn<Run>(async () => ({
      code: 0,
      stdout: 'value\n',
      stderr: '',
    }));

    expect(await new FirebaseSecrets(run).read('NAME')).toBe('value');
    expect(run).toHaveBeenCalledWith([
      'functions:secrets:access',
      'NAME',
      '--project',
      'bacteria-wars',
    ]);
  });

  it('reads a secret that does not exist as none, as the CLI logs it on stdout', async () => {
    const run: Run = async () => ({
      code: 1,
      stdout:
        '\nError: Request to https://secretmanager.googleapis.com/v1/projects/bacteria-wars/secrets/NAME/versions/latest:access had HTTP Error: 404, Secret [projects/1/secrets/NAME] not found or has no versions.\n',
      stderr: '',
    });
    expect(await new FirebaseSecrets(run).read('NAME')).toBeNull();
  });

  it("reads another secret's 404 as a failure", async () => {
    const run: Run = async () => ({
      code: 1,
      stdout:
        'Error: HTTP Error: 404, Secret [projects/1/secrets/OTHER] not found',
      stderr: '',
    });
    await expect(new FirebaseSecrets(run).read('NAME')).rejects.toThrow(
      'Reading the secret NAME failed'
    );
  });

  it('throws on any other failure, never reading it as none', async () => {
    const run: Run = async () => ({
      code: 1,
      stdout: 'Error: Failed to make request: ETIMEDOUT',
      stderr: '',
    });
    await expect(new FirebaseSecrets(run).read('NAME')).rejects.toThrow(
      'Reading the secret NAME failed (exit 1): Error: Failed to make request: ETIMEDOUT'
    );
  });

  it('writes a value through stdin, never as an argument', async () => {
    const run = jest.fn<Run>(async () => ({
      code: 0,
      stdout: '',
      stderr: '',
    }));

    await new FirebaseSecrets(run).write('NAME', 'value');

    const [args, input] = run.mock.calls[0] ?? [];
    expect(args).toContain('--data-file=-');
    expect(args).not.toContain('value');
    expect(input).toBe('value');
  });

  it('throws when the CLI refuses to store it', async () => {
    const run: Run = async () => ({ code: 2, stdout: '', stderr: 'denied' });
    await expect(new FirebaseSecrets(run).write('NAME', 'v')).rejects.toThrow(
      'Storing the secret NAME failed (exit 2): denied'
    );
  });
});
