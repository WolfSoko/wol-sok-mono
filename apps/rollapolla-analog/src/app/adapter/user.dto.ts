import { FieldValue, Timestamp } from '@angular/fire/firestore';

/** `users/{uid}`: written by the visitor on each visit with Google. */
export interface UserDto {
  displayName: string | null;
  photoUrl: string | null;
  lastSeenAt: Timestamp;
}

/** `admins/{uid}`: an admin's grant. */
export interface AdminGrantDto {
  grantedAt: Timestamp | FieldValue;
  grantedBy: string;
}
