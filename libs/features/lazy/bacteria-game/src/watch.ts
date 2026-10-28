/**
 * The public replay viewer on its own (ADR 0011),
 * `@wolsok/feat-lazy-bac-game/watch`: the remote's `/watch/{publicId}`
 * loads it from here rather than from the lib's index, so its chunk holds
 * the viewer, the arena and the engine - not the game's stage, its cloud
 * or Firebase.
 */
export { WatchPageComponent } from './lib/replays/watch-page.component';
