import { Request, Response, NextFunction } from 'express';
import { usersService } from '../../../admin/services/usersService';
import { ADMIN_PORTAL_ROLES, SUPER_ADMIN_ROLES, UserRole } from '../../../admin/utils/roleMiddleware';
import { assertMemberApartment } from '../../services/memberPortalService';
import { getJwtSecret, verifyAccessToken } from '../services/apiTokenService';
import { ApiUser } from '../types';
import '../types';
import { sendError } from '../utils/apiResponse';

type UserLookup = (id: number) => Promise<ApiUser | null>;
type ApartmentCheck = (userId: number, apartmentId: number) => Promise<unknown>;

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

export function requireApiConfigured(req: Request, res: Response, next: NextFunction): void {
  if (!getJwtSecret()) {
    sendError(res, 503, 'The mobile API is not configured on this server.');
    return;
  }
  next();
}

export function createRequireApiUser(lookupUser: UserLookup) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const secret = getJwtSecret();
      if (!secret) {
        sendError(res, 503, 'The mobile API is not configured on this server.');
        return;
      }
      const token = bearerToken(req);
      const claims = token ? verifyAccessToken(token, secret) : null;
      if (!claims) {
        sendError(res, 401, 'Please sign in.');
        return;
      }
      const user = await lookupUser(claims.userId);
      if (!user || user.status !== 'Active') {
        sendError(res, 401, 'Your account is not active.');
        return;
      }
      req.apiUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireApiUser = createRequireApiUser(async (id) => {
  const user = await usersService.getUserById(id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    walletEnabled: Boolean(user.walletEnabled)
  };
});

export function requireApiRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.apiUser?.role;
    if (!role) {
      sendError(res, 401, 'Please sign in.');
      return;
    }
    if (!roles.includes(role as UserRole)) {
      sendError(res, 403, 'You do not have permission to do this.');
      return;
    }
    next();
  };
}

/** Read access to the admin area (same roles that can log into /admin). */
export const requireApiAdmin = requireApiRole(...ADMIN_PORTAL_ROLES);

/** Write access in the admin area (matches the website: Super Admin only). */
export const requireApiSuperAdmin = requireApiRole(...SUPER_ADMIN_ROLES);

export function createRequireApartmentAccess(checkAccess: ApartmentCheck, param = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.apiUser?.id;
      if (!userId) {
        sendError(res, 401, 'Please sign in.');
        return;
      }
      const apartmentId = parseInt(String(req.params[param] || ''), 10);
      if (!Number.isFinite(apartmentId)) {
        sendError(res, 400, 'Invalid apartment.');
        return;
      }
      const allowed = await checkAccess(userId, apartmentId);
      if (!allowed) {
        sendError(res, 404, 'Apartment not found.');
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireApartmentAccess = createRequireApartmentAccess(assertMemberApartment);
