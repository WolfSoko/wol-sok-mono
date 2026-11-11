// What the app uses, and no more: the change functions, the document's fields
// and the merge stay inside the lib.
export { type Selection } from './lib/selection';
export { contentOf } from './lib/selection-changes';
export {
  type TeamPlace,
  readSelectionDocument,
} from './lib/selection-document';
export {
  SELECTION_LIMITS,
  SELECTION_LISTS,
  type SelectionContent,
  type SelectionList,
  EMPTY_SELECTION,
  selectionIsEmpty,
  selectionWithout,
  selectionJoined,
} from './lib/selection-lists';
export { listSignals } from './lib/list-signals';
export {
  SelectionFullError,
  SelectionTooNewError,
} from './lib/selection-errors';
export {
  FirestoreSelection,
  selectionDocumentOf,
} from './lib/firestore-selection';
export { takeOverDevice } from './lib/take-over-device';
export { sameSequence } from './lib/same-sequence';
export {
  type Child,
  type MarkablePlayer,
  NICKNAME_CODE_POINTS,
  NICKNAME_LENGTH,
  nicknameCharacterCount,
} from './lib/child';
export { SELECTION_KEY, LocalSelection } from './lib/local-selection';
export {
  NotAColorError,
  type ClubColors,
  sameColors,
  clubColorsOf,
} from './lib/club-colors';
export { type ClubColorsChoice, clubColorsFor } from './lib/club-colors-choice';
export { type NotTakenOver } from './lib/merge-selections';
