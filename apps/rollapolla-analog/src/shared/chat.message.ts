export type ChatMessage = {
  id: string;
  message: string;
  createdAt: Date;
  /** Who wrote it. Missing on messages from before chatting needed a sign-in. */
  authorUid?: string;
};
