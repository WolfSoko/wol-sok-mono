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
  /*
   * The keys that fire a weapon, next to the boost keys:
   * "{left} fires the weapon with E, {right} with the right Shift."
   */
  weaponKeys: {
    leftFires: '{name} fires the weapon with',
    rightFires: '{name} with the',
    e: 'E',
    shift: 'right Shift',
    both: 'Against the computer either key fires yours.',
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
