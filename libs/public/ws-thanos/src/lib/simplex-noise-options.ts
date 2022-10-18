export interface SimplexNoiseOptions {
  amplitude: number; // The base amplitude (default: 1.0)
  frequency: number; // The base frequency (default: 1.0)
  max: number; // The maximum scaled value to return (effective default: 1.0)
  min: number; // The minimum scaled value to return (effective default: -1.0)
  octaves: number; // Integer; the number of octaves to sum for noise generation (default: 1)
  persistence: number; // The persistence of amplitude per octave (default: 0.5)
  random: () => number; // A function that generates random values between 0 and 1 (default: Math.random)
}
