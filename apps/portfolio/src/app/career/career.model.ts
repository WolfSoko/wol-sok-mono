import { Localized } from '../i18n/language';

/** One engagement of the career, as the qualification profile lists it. */
export interface CareerProject {
  /** Stable id, used as the DOM id and for tests. */
  id: string;
  /** First and last year of the engagement. */
  from: number;
  to: number;
  /** The client, or the institution of the thesis. */
  client: string;
  /** Who the client was reached through, such as an agency. */
  via?: string;
  /** A thesis counts as a project, but not as a client. */
  kind?: 'thesis';
  role: Localized;
  /** What the engagement was about, one sentence. */
  summary: Localized;
  durationMonths?: number;
  /** The team's size, as the profile puts it: "6 – 8". */
  teamSize?: string;
  workplace?: Localized;
  projectLanguage?: Localized;
  highlights: Localized<readonly string[]>;
  technologies: readonly string[];
  methods?: readonly string[];
  /** The card's accent, a CSS colour. */
  accent: string;
}

export interface SkillGroup {
  name: Localized;
  items: readonly string[];
}

export interface Certification {
  year: number;
  name: string;
}

export interface CareerProfile {
  name: string;
  title: Localized;
  born: number;
  nationality: Localized;
  location: Localized;
  /** First year as a software engineer. */
  since: number;
  /** First year with Angular (AngularJS then). */
  angularSince: number;
  education: Localized<readonly string[]>;
  certifications: readonly Certification[];
  languages: Localized<readonly string[]>;
  /** What the profile calls "Erfahrungsschwerpunkte". */
  focus: readonly { name: Localized; detail: Localized }[];
  industries: Localized<readonly string[]>;
  softSkills: Localized<readonly string[]>;
  skills: readonly SkillGroup[];
  github: string;
  email: string;
}

/** The qualification profile in Google Drive the data was taken from. */
export interface CareerSource {
  /** The Drive folder holding every version of the profile. */
  folderId: string;
  /** The newest profile at the time of the last update. */
  fileId: string;
  fileName: string;
  /** The profile's date, from its file name (ISO date). */
  profileDate: string;
  /** When the data here was last compared with Drive (ISO date). */
  checkedAt: string;
}

/** The whole page's data: profile, projects (newest first) and source. */
export interface Career {
  profile: CareerProfile;
  projects: readonly CareerProject[];
  source: CareerSource;
}

/** Years from `since` to the end of `year`, as the profile counts them. */
export function yearsSince(since: number, year: number): number {
  return Math.max(0, year - since);
}

/** The clients an engagement was done for, the thesis left out. */
export function countClients(projects: readonly CareerProject[]): number {
  return new Set(
    projects.filter((project) => project.kind !== 'thesis').map((p) => p.client)
  ).size;
}
