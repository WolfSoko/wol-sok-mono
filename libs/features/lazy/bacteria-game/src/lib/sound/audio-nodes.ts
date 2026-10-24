/**
 * The plumbing the two music players share: a soundtrack's contract, an
 * echo, fades and a one-shot oscillator.
 */

/** What plays underneath the game - a level's music or the menu's. */
export interface SoundtrackPlayer {
  /** Fades the music in, `atSec` seconds into it. */
  start(atSec?: number): void;
  /** Fades the music out and lets go of its audio nodes. */
  stop(): void;
  /** Heats the music up with the fighting - where it listens. */
  excite(amount: number): void;
}

export interface EchoOptions {
  delaySec: number;
  /** How much of each repeat feeds back, from 0 (one repeat) to about 0.5. */
  feedback: number;
  /** How loud the repeats are next to the dry signal. */
  wet: number;
  /** A low-pass over the repeats, so each is darker than the one before. */
  darkenHz?: number;
}

/**
 * Wires an echo from `input` to `destination`: a delay fed back into
 * itself, with the repeats mixed in beside the dry signal. Returns the
 * nodes to let go of once the music stops.
 */
export function feedbackEcho(
  context: AudioContext,
  input: AudioNode,
  destination: AudioNode,
  options: EchoOptions
): AudioNode[] {
  const delay = context.createDelay(Math.max(1, options.delaySec));
  delay.delayTime.value = options.delaySec;
  const feedback = context.createGain();
  feedback.gain.value = options.feedback;
  const wet = context.createGain();
  wet.gain.value = options.wet;
  const nodes: AudioNode[] = [delay, feedback, wet];
  input.connect(delay);
  let repeats: AudioNode = delay;
  if (options.darkenHz != null) {
    const darken = context.createBiquadFilter();
    darken.type = 'lowpass';
    darken.frequency.value = options.darkenHz;
    delay.connect(darken);
    repeats = darken;
    nodes.push(darken);
  }
  repeats.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(destination);
  return nodes;
}

/** Fades a bus in over about `seconds`. */
export function fadeIn(
  context: AudioContext,
  bus: GainNode,
  seconds: number
): void {
  const now = context.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(1, now, seconds);
}

/**
 * Fades a bus out over about `seconds` and, once its tail has rung out,
 * disconnects it and the nodes behind it.
 */
export function fadeOutAndRelease(
  context: AudioContext,
  bus: GainNode,
  nodes: readonly AudioNode[],
  seconds: number,
  tailMs: number,
  onRelease?: () => void
): void {
  const now = context.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(0, now, seconds);
  const all = [bus, ...nodes];
  setTimeout(() => {
    onRelease?.();
    all.forEach((node) => node.disconnect());
  }, tailMs);
}

export interface OscillatorOptions {
  type?: OscillatorType;
  /** A custom waveform instead of a type. */
  wave?: PeriodicWave;
  hz: number;
  /** Cents off the pitch. */
  detune?: number;
  /** Where it plays into. */
  into: AudioNode;
  at: number;
  stopAt: number;
}

/** An oscillator that plays from `at` to `stopAt` into a node. */
export function oscillator(
  context: AudioContext,
  options: OscillatorOptions
): OscillatorNode {
  const node = context.createOscillator();
  if (options.wave != null) {
    node.setPeriodicWave(options.wave);
  } else {
    node.type = options.type ?? 'sine';
  }
  node.frequency.value = options.hz;
  node.detune.value = options.detune ?? 0;
  node.connect(options.into);
  node.start(options.at);
  node.stop(options.stopAt);
  return node;
}
