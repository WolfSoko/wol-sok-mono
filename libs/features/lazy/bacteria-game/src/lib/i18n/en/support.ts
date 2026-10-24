/**
 * Everything the game's own site adds around the game: tips and ads (the
 * support tile, card and dialog, the ad slot), the offer to install the
 * game as an app, and the legal lines under the menu.
 */
export const support = {
  tile: 'Support',
  title: 'Support the game',
  dialogTitle: 'Support Bacteria Wars',
  pitch:
    'The game is free and made in my spare time. If it gives you a good fight, a coffee keeps the servers running and new levels coming.',
  buyCoffee: 'Buy me a coffee',
  thanks: 'Thank you for the coffee!',
  failed: 'The purchase did not go through. Please try again.',
  close: 'Close',
  ad: 'Ad',
  adSettings: 'Ad privacy settings',
  install: {
    title: 'Play Bacteria Wars as an app',
    /** How to get it, one text per platform (`InstallPlatform`). */
    android:
      'Fullscreen, offline and right on your home screen: get the app on Google Play, or install this web app.',
    ios: 'Fullscreen, offline and right on your home screen: tap Share, then “Add to Home Screen”.',
    other:
      'Fullscreen, offline and right on your desktop: install the web app.',
    playStore: 'Get it on Google Play',
    webApp: 'Install web app',
    dismiss: 'Not now',
  },
  footer: {
    label: 'Legal',
    privacy: 'Privacy policy',
    legalNotice: 'Legal notice',
  },
};
