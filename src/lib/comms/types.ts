export interface Msg {
  sender: string | null;
  text: string;
  /** Raw date/time text from the chat header, if the format had one. */
  stamp: string | null;
}

export interface Item {
  sender: string | null;
  text: string;
  /** What matched (dates only). */
  matches?: string[];
}

export interface Analysis {
  messageCount: number;
  participants: string[];
  firstStamp: string | null;
  lastStamp: string | null;
  questions: Item[];
  actions: Item[];
  dates: Item[];
  important: Item[];
  /** null when the user did not say which participant they are. */
  pending: Item[] | null;
  frequentWords: string[];
}

export const MAX_CHARS = 20_000;
