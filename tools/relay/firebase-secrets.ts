import { spawn } from 'node:child_process';

/** The Firebase project whose Secret Manager holds the relay's secrets. */
export const PROJECT = 'bacteria-wars';

/**
 * The secret Secret Manager reports missing, as the CLI logs its 404 (on
 * stdout, not stderr): `Secret [projects/<number>/secrets/<name>] not found`.
 * The request URL also names a secret, so only this part counts.
 */
const MISSING_SECRET =
  /HTTP Error: 404, Secret \[projects\/[^/\]]+\/secrets\/([^/\]]+)\] not found/;

/** Whether the CLI's output says that exactly the secret `name` does not exist. */
function notFound(name: string, output: string): boolean {
  return MISSING_SECRET.exec(output)?.[1] === name;
}

/** Runs a command with `input` on stdin, answering its exit code and stdout. */
export type Run = (
  args: readonly string[],
  input?: string
) => Promise<{ code: number; stdout: string; stderr: string }>;

/**
 * The Firebase CLI through npx; stdout is captured, never printed, so a
 * secret it reads stays in memory. Its stderr is captured too, and shown
 * only when the command fails.
 */
export const runFirebase: Run = (args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn('npx', ['firebase', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(input ?? '');
  });

/**
 * The secrets in Secret Manager of {@link PROJECT}, through the Firebase
 * CLI: the owner's login, no key file.
 */
export class FirebaseSecrets {
  public constructor(private readonly run: Run = runFirebase) {}

  /**
   * The latest version's value - null when the secret does not exist.
   * Any other failure throws: read as "none", it would set up a new key.
   */
  public async read(name: string): Promise<string | null> {
    const { code, stdout, stderr } = await this.run([
      'functions:secrets:access',
      name,
      '--project',
      PROJECT,
    ]);
    if (code === 0) {
      return stdout.trim();
    }
    // A failed read prints no secret: its output is the CLI's error.
    const output = `${stdout}\n${stderr}`.trim();
    if (notFound(name, output)) {
      return null;
    }
    throw new Error(
      `Reading the secret ${name} failed (exit ${code}): ${output}`
    );
  }

  /**
   * A new version of the secret. Deployed functions keep the version they
   * were deployed with until the next deploy of theirs: the CLI redeploys
   * nothing when run from a script.
   */
  public async write(name: string, value: string): Promise<void> {
    const { code, stderr } = await this.run(
      ['functions:secrets:set', name, '--project', PROJECT, '--data-file=-'],
      value
    );
    if (code !== 0) {
      throw new Error(
        `Storing the secret ${name} failed (exit ${code}): ${stderr.trim()}`
      );
    }
  }
}
