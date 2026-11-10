// Its own entry: it loads the Firebase web SDK and the rules-unit-testing
// library, which an admin-only spec (bacteria-wars-functions) needs not.
export {
  type FirestoreEmulator,
  rulesTestEnvironment,
} from './lib/rules-test-environment';
