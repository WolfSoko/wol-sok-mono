/**
 * The DBB fixtures' tooling: a fake DBB that answers from them (specs, the
 * Korbjäger e2e), and the anonymiser with its folder check, which the
 * fixture scripts in `tools/korbjaeger/` run on recorded responses.
 */
export {
  anonymiseFixtures,
  survivingPersonData,
} from './testing/anonymise-fixtures';
export { fakeDbbAnswer } from './testing/fake-dbb';
export { isOutsideFolder } from './testing/outside-folder';
