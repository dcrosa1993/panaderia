import type { Request } from 'express';
import type { MembershipRole } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from './authenticated-user.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  bakeryId?: string;
  membershipRole?: MembershipRole;
}
