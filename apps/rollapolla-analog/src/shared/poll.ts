export type Poll = {
  id: string;
  question: string;
  options: string[];
  /** Votes per option, same order as `options`. */
  counts: number[];
  totalVotes: number;
  createdAt: Date;
  creatorUid: string;
};

export type NewPoll = {
  question: string;
  options: string[];
};
