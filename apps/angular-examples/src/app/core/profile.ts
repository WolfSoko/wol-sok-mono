export interface Profile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  [key: string]: unknown;
}
