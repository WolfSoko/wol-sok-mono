/** The settings screen. */
export const settings = {
  title: 'Settings',
  display: {
    title: 'Display',
    arena: 'Arena',
    ownArena: 'Each level its own',
    simResolution: 'Simulation resolution',
    simResolutions: {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      ultra: 'Ultra',
    },
    cells: '{width} × {height} cells',
    vaporize: 'Vaporize effect',
    vaporizeQualities: {
      off: 'Off',
      low: 'Low',
      medium: 'Medium',
      full: 'Full',
    },
    vaporizeDuration: 'Vaporize duration',
    vaporizeDurations: {
      short: 'Short',
      normal: 'Normal',
      long: 'Long',
    },
    ambience: 'Bubbles and mist in the dish',
    screenResolution: 'Screen resolution',
    locked:
      'Pick the colours and resolutions before a match - they stay as they are while one is on.',
  },
  sound: {
    title: 'Sound',
    sound: 'Sound',
    music: 'Music',
    musicVolume: 'Music volume',
    effects: 'Sound effects',
    effectsVolume: 'Effects volume',
    vibration: 'Vibration',
    vibrationNote:
      'A buzz for a boost, a thud for a gate, a flourish for a medallion.',
  },
  screen: {
    title: 'Screen',
    showFps: 'Show the frame rate',
    fullscreen: 'Browser fullscreen',
  },
  simulation: {
    gpuInt: 'Matches run on the GPU, alike on every device.',
    cpu: 'Matches run on the CPU.',
    forced: 'Set for this device by ?sim={ruleset}; ?sim=auto undoes it.',
    passed: 'GPU self-test passed on {renderer}.',
    software:
      'GPU self-test passed on {renderer}, which draws on the CPU - too slow for matches on the GPU.',
    failedAt: 'GPU self-test failed at tick {tick} on {renderer}.',
    error: 'GPU self-test could not run on {renderer}: {error}',
    pending: 'GPU self-test not run yet.',
  },
  language: {
    title: 'Language',
    automatic: 'Automatic',
    note: "Automatic follows the browser's language.",
  },
};
