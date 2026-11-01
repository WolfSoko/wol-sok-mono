/**
 * Where mail to an address at wolsok.de goes: ImprovMX forwards it (the
 * domain's MX records) to the owner's Gmail inbox. Every privacy policy
 * names both through `EmailForwardingComponent`, so a change of either
 * belongs here. Its text says the forwarder is a company in the USA: a
 * forwarder elsewhere changes that sentence too.
 */
export const EMAIL_FORWARDING = {
  forwarder: {
    service: 'ImprovMX',
    company: 'ImprovMX Incorporated',
    address: '8 The Green STE D, Dover, Delaware 19901, USA',
  },
  inbox: {
    service: 'Gmail',
    company: 'Google Ireland Limited',
    address: {
      de: 'Gordon House, Barrow Street, Dublin 4, Irland',
      en: 'Gordon House, Barrow Street, Dublin 4, Ireland',
    },
  },
} as const;
