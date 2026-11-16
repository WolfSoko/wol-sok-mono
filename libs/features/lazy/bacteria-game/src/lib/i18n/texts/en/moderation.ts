/** The ban banner and the owner's notices (ADR 0012). */
export const moderation = {
  banner: {
    until: 'Your account is suspended until {until}.',
    permanent: 'Your account is suspended.',
    reason: 'Reason: {reason}.',
    blocked:
      'Until then you can play against the computer, but not online, and nothing is saved to your account: your progress waits on this device while the game stays open.',
  },
  reasons: {
    cheating: 'cheating',
    'offensive-profile': 'an offensive profile',
    spam: 'spam',
    other: 'another breach of the rules',
  },
  notices: {
    region: 'Notices',
    dismiss: 'Dismiss',
    'profile-reset':
      'Your profile was reset: name, motto and picture are back to the start.',
    'image-removed': 'Your uploaded picture was removed.',
    'board-hidden': 'An entry of yours on the leaderboards was hidden.',
    banned: 'Your account was suspended.',
    unbanned: 'Your suspension has ended. Welcome back!',
  },
  online: 'Online play is not available while your account is suspended.',
  profile: 'Your profile cannot be changed while your account is suspended.',
  friends: 'Friends cannot be added while your account is suspended.',
};
