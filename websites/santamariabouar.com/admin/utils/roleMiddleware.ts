import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/usersService';

export type UserRole = 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';

/** Roles allowed to log into /admin */
export const ADMIN_PORTAL_ROLES: UserRole[] = ['Super Admin', 'Admin'];

/** Roles with full write access */
export const SUPER_ADMIN_ROLES: UserRole[] = ['Super Admin'];

/** Roles that can view (read-only) users, apartments, and reports */
export const ADMIN_VIEW_ROLES: UserRole[] = ['Super Admin', 'Admin'];

// Define role permissions (used by requireAdminAccess path checks)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Super Admin': ['*'],
  'Admin': [
    '/admin/dashboard',
    '/admin/profile',
    '/admin/apartments',
    '/admin/users',
    '/admin/main-gate-access',
    '/admin/gate-open-log',
    '/admin/reports',
    '/admin/transactions/report',
    '/admin/common-expenses/unpaid-report'
  ],
  'Content Manager': [],
  'Accounting': [],
  'Member': []
};

export function canLoginToAdmin(role: string): boolean {
  return ADMIN_PORTAL_ROLES.includes(role as UserRole);
}

export function isSuperAdmin(role: string): boolean {
  return role === 'Super Admin';
}

/**
 * Check if user has permission to access a route
 */
export function hasPermission(userRole: UserRole, route: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];

  if (permissions.includes('*')) {
    return true;
  }

  for (const permission of permissions) {
    if (route.startsWith(permission)) {
      return true;
    }
  }

  return false;
}

/**
 * Middleware to check role-based access
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req.session as any).user;

      if (!currentUser) {
        return res.redirect('/admin/login?error=Please log in to continue');
      }

      const user = await usersService.getUserById(currentUser.id);
      if (!user) {
        return res.redirect('/admin/login?error=User not found');
      }

      if (!canLoginToAdmin(user.role)) {
        return res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'Admin portal access denied',
          message: 'Only Super Admin and Admin users can access the admin portal.',
          layout: false
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'You do not have permission to access this page',
          message: `This page requires one of the following roles: ${allowedRoles.join(', ')}. Your role is: ${user.role}`,
          layout: 'admin-layout'
        });
      }

      next();
    } catch (error) {
      console.error('Error in role middleware:', error);
      res.status(500).send('Internal Server Error');
    }
  };
}

/**
 * Middleware for Super Admin / Admin portal access with path-based permissions.
 * Blocks all roles except Super Admin and Admin.
 */
export function requireAdminAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req.session as any).user;

      if (!currentUser) {
        return res.redirect('/admin/login?error=Please log in to continue');
      }

      const user = await usersService.getUserById(currentUser.id);
      if (!user) {
        return res.redirect('/admin/login?error=User not found');
      }

      if (!canLoginToAdmin(user.role)) {
        return res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'Admin portal access denied',
          message: 'Only Super Admin and Admin users can access the admin portal.',
          layout: false
        });
      }

      const route = '/admin' + req.path;
      if (!hasPermission(user.role, route)) {
        return res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'Insufficient permissions',
          message: `You do not have permission to access ${route}. Your role is: ${user.role}`,
          layout: 'admin-layout'
        });
      }

      next();
    } catch (error) {
      console.error('Error in admin access middleware:', error);
      res.status(500).send('Internal Server Error');
    }
  };
}
