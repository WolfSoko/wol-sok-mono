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
    adaptiveQuality: 'Adapt the sharpness to the device',
    adaptiveQualityNote:
      'Where the frames come too slowly, the arena is drawn with fewer pixels.',
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
  matches: {
    title: 'Matches',
    recordLocal: 'Record matches against the computer',
    recordLocalNote:
      'With "Save my matches" they are kept in My matches: in the cloud for 30 days, or on this device without it.',
    saveMatches: 'Save my matches',
    saveMatchesNote: 'Online matches are always kept.',
  },
  simulation: {
    choice: 'Simulation',
    auto: 'Auto',
    gpu: 'GPU',
    cpuChoice: 'CPU',
    gpuInt: 'Matches run on the GPU, alike on every device.',
    cpu: 'Matches run on the CPU.',
    forced: 'Chosen for this device - Auto lets the game decide again.',
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
