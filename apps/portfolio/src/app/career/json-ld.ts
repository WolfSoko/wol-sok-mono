import { Career } from './career.model';

/**
 * The `Person` schema.org data of the career page, for search engines. The
 * texts are the English ones, as the page is prerendered in English; every
 * value comes from the profile, so the monthly update carries over.
 */
export function personJsonLd(career: Career, url: string): string {
  const { profile, projects } = career;
  const thesis = projects.find((project) => project.kind === 'thesis');
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.title.en,
    url,
    sameAs: [profile.github],
    nationality: profile.nationality.en,
    address: {
      '@type': 'PostalAddress',
      addressLocality: profile.city,
      addressCountry: profile.country.en,
    },
    knowsAbout: profile.skills.flatMap((group) => group.items),
    ...(thesis && {
      alumniOf: { '@type': 'CollegeOrUniversity', name: thesis.client },
    }),
    hasCredential: profile.certifications.map((certification) => ({
      '@type': 'EducationalOccupationalCredential',
      name: certification.name,
    })),
  });
}
