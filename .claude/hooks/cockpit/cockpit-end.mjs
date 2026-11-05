import { runsAsHook, post, readInput, sessionOf } from './shared.mjs';

// The marker stays: a `--resume` keeps the id, and the conversation already has the context.
async function main() {
  const input = await readInput();
  if (input === null) return;
  const sitzung = sessionOf(input);
  if (sitzung === null) return;
  await post('/api/cockpit/sitzung-ende', { sitzung }, 3000);
}

if (runsAsHook(import.meta.url)) {
  main()
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
    });
}
