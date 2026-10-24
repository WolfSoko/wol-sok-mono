/** The game's engine, Angular-free (ADR 0011): replays, levels, the contracts. */
export type Engine = typeof import('@wolsok/feat-lazy-bac-game/engine');

let loading: Promise<Engine> | null = null;

/**
 * Loads the engine on first use. Every other module imports only its types,
 * so the bundle keeps it in a chunk of its own, and a function that never
 * reads a replay does not pay for it on a cold start.
 */
export function loadEngine(): Promise<Engine> {
  loading ??= import('@wolsok/feat-lazy-bac-game/engine');
  return loading;
}
