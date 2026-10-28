import { Career } from './career.model';

/**
 * The `Person` schema.org data of the career page, for search engines. The
 * texts are the English ones, as the page is prerendered in English.
 */
export function personJsonLd(career: Career, url: string): string {
  const { profile, projects } = career;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.title.en,
    url,
    sameAs: [profile.github],
    nationality: profile.nationality.en,
    address: { '@type': 'PostalAddress', addressLocality: 'Hamburg' },
    knowsLanguage: ['de', 'en'],
    knowsAbout: profile.skills.flatMap((group) => group.items),
    alumniOf: {
      '@type': 'CollegeOrUniversity',
      name: 'HAW Hamburg',
    },
    hasCredential: profile.certifications.map((certification) => ({
      '@type': 'EducationalOccupationalCredential',
      name: certification.name,
    })),
    worksFor: projects
      .filter((project) => project.kind !== 'thesis')
      .map((project) => ({
        '@type': 'Organization',
        name: project.client,
      })),
  });
}
