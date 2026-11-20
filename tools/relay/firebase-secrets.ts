import { spawn } from 'node:child_process';

/** The Firebase project whose Secret Manager holds the relay's secrets. */
export const PROJECT = 'bacteria-wars';

/** Runs a command with `input` on stdin, answering its exit code and stdout. */
export type Run = (
  args: readonly string[],
  input?: string
) => Promise<{ code: number; stdout: string }>;

/**
 * The Firebase CLI through npx; stdout is captured, never printed, so a
 * secret it reads stays in memory. Its stderr goes to the terminal.
 */
export const runFirebase: Run = (args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn('npx', ['firebase', ...args], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout }));
    child.stdin.end(input ?? '');
  });

/**
 * The secrets in Secret Manager of {@link PROJECT}, through the Firebase
 * CLI: the owner's login, no key file.
 */
export class FirebaseSecrets {
  public constructor(private readonly run: Run = runFirebase) {}

  /** The latest version's value - null when the secret does not exist. */
  public async read(name: string): Promise<string | null> {
    const { code, stdout } = await this.run([
      'functions:secrets:access',
      name,
      '--project',
      PROJECT,
    ]);
    return code === 0 ? stdout.trim() : null;
  }

  /**
   * A new version of the secret - `--force` lets the CLI move the
   * functions that use it onto it without asking.
   */
  public async write(name: string, value: string): Promise<void> {
    const { code } = await this.run(
      [
        'functions:secrets:set',
        name,
        '--project',
        PROJECT,
        '--data-file=-',
        '--force',
      ],
      value
    );
    if (code !== 0) {
      throw new Error(`Storing the secret ${name} failed (exit ${code}).`);
    }
  }
}
