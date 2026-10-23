/**
 * The touch controls of a match - the joystick zone and the boost pad - and
 * the colour picker of the two seats.
 */
export const controls = {
  joystick: 'Joystick {name}',
  boost: {
    ready: 'Boost',
    boosting: 'Boosting',
    cooldown: '{seconds}s',
    button: 'Boost {name}',
    recharge: 'Boost recharge',
    share: 'Share of all bacteria',
  },
  colors: {
    left: 'Left player',
    right: 'Right player',
    group: 'Colour of {seat}',
    locked: '{color}, locked: {lock}',
    lockedTip: '{color} - {lock}',
    toEarn: 'Colours still to earn',
  },
};
