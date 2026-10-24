import type { colony as en } from '../en/colony';
import type { Translation } from '../translation';

export const colony: Translation<typeof en> = {
  title: 'Meine Kolonie',
  tagline: 'Das bist du in der Schale. Mach sie unverwechselbar zu deiner.',
  preview: 'Deine Kolonie im Skin {skin}',
  skin: {
    title: 'Skin',
    note: 'Jeder Skin ist frei – nimm den, der zu dir passt. Jede Kolonie in der Schale trägt ihn.',
    names: {
      slime: 'Schleim',
      cells: 'Zellen',
      honeycomb: 'Wabe',
      crystal: 'Kristall',
      neon: 'Neon',
      ink: 'Tusche',
      bubbles: 'Blasen',
      pixels: 'Pixel',
    },
  },
  color: {
    title: 'Farbe',
    swapNote: 'Wählst du die Farbe der anderen Kolonie, tauschen die beiden.',
  },
  more: {
    title: 'Bald mehr',
    note: 'Namen, Fadenkreuze und mehr an deiner Kolonie formst du künftig hier.',
  },
};
