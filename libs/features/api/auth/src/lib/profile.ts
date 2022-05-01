export interface Profile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
