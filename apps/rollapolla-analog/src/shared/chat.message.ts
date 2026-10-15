export type ChatMessage = {
  id: string;
  message: string;
  createdAt: Date;
  /** Missing on messages written before sign-in was required. */
  authorUid?: string;
  /** The Google name of the author; anonymous authors have none. */
  authorName?: string | null;
  /** Only when writing: when Firestore deletes it. Defaults to a week. */
  expiresAt?: Date;
};
