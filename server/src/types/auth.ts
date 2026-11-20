import { Request } from 'express';
import { RoleName } from '@prisma/client';

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: RoleName;
  organisationId: string;
}

export interface TenantContext {
  organisationId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserSessionPayload;
  tenant?: TenantContext;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSessionPayload;
}
