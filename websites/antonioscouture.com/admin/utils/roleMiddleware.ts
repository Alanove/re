import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/usersService';

export type UserRole = 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';

// Define role permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Super Admin': ['*'], // Access to everything
  'Admin': ['*'], // Access to everything
  'Content Manager': [
    '/admin/dashboard',
    '/admin/pages',
    '/admin/projects',
    '/admin/menus',
    '/admin/profile'
  ],
  'Accounting': [
    '/admin/dashboard',
    '/admin/transactions',
    '/admin/payments',
    '/admin/accounts',
    '/admin/transaction-categories',
    '/admin/profile'
  ],
  'Member': [] // No admin access
};

/**
 * Check if user has permission to access a route
 */
export function hasPermission(userRole: UserRole, route: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  
  // Super Admin and Admin have access to everything
  if (permissions.includes('*')) {
    return true;
  }
  
  // Check if the route is in the allowed permissions
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
        res.redirect('/admin/login?error=Please log in to continue');
        return;
      }
      
      // Get full user data to check role
      const user = await usersService.getUserById(currentUser.id);
      if (!user) {
        res.redirect('/admin/login?error=User not found');
        return;
      }
      
      // Check if user has the required role
      if (!allowedRoles.includes(user.role)) {
        // Check if this is an AJAX request
        const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                      req.headers.accept?.includes('application/json');
        
        if (isAjax) {
          res.status(403).json({
            success: false,
            errors: [`Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role is: ${user.role}`]
          });
          return;
        }
        
        res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'You do not have permission to access this page',
          message: `This page requires one of the following roles: ${allowedRoles.join(', ')}. Your role is: ${user.role}`,
          layout: 'admin-layout'
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Error in role middleware:', error);
      res.status(500).send('Internal Server Error');
    }
  };
}

/**
 * Middleware to block Member role from admin access
 */
export function requireAdminAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req.session as any).user;
      
      if (!currentUser) {
        res.redirect('/admin/login?error=Please log in to continue');
        return;
      }
      
      // Get full user data to check role
      const user = await usersService.getUserById(currentUser.id);
      if (!user) {
        res.redirect('/admin/login?error=User not found');
        return;
      }
      
      // Block Members from accessing admin
      if (user.role === 'Member') {
        res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'Members cannot access the admin panel',
          message: 'You need admin privileges to access this area.',
          layout: false
        });
        return;
      }
      
      // Check route-specific permissions for other roles
      const route = '/admin' + req.path;
      if (!hasPermission(user.role, route)) {
        res.status(403).render('403', {
          title: 'Access Denied',
          pageTitle: 'Access Denied',
          pageSubtitle: 'Insufficient permissions',
          message: `You do not have permission to access ${route}. Your role is: ${user.role}`,
          layout: 'admin-layout'
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Error in admin access middleware:', error);
      res.status(500).send('Internal Server Error');
    }
  };
}
