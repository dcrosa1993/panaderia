export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
}
