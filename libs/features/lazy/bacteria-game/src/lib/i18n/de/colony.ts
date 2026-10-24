import type { colony as en } from '../en/colony';
import type { Translation } from '../translation';

export const colony: Translation<typeof en> = {
  title: 'Meine Kolonie',
  tagline: 'Das bist du in der Schale. Mach sie unverwechselbar zu deiner.',
  preview: 'Deine Kolonie im Skin {skin}',
  skin: {
    title: 'Skin',
    note: 'Die ersten Skins sind frei. Die edlen kosten DNA, die deine XP wachsen lassen – und bleiben dir durch jeden Reset erhalten. Jede Kolonie in der Schale trägt deinen Skin.',
    buy: 'Kaufen',
    buyLabel: 'Skin {name} für {cost} DNA kaufen',
    names: {
      slime: 'Schleim',
      cells: 'Zellen',
      honeycomb: 'Wabe',
      crystal: 'Kristall',
      neon: 'Neon',
      ink: 'Tusche',
      bubbles: 'Blasen',
      pixels: 'Pixel',
      marbles: 'Murmeln',
      lava: 'Lava',
      galaxy: 'Galaxie',
      plasma: 'Plasma',
      chrome: 'Chrom',
    },
  },
  color: {
    title: 'Farbe',
    swapNote: 'Wählst du die Farbe der anderen Kolonie, tauschen die beiden.',
  },
  announce: {
    bought: 'Der Skin {name} gehört dir – deine Kolonie trägt ihn.',
  },
  menu: {
    ready: '{count} DNA – ein neuer Skin ist in Reichweite',
  },
  more: {
    title: 'Bald mehr',
    note: 'Namen, Fadenkreuze und mehr an deiner Kolonie formst du künftig hier.',
  },
};
