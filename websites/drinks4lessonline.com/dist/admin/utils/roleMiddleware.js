"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
exports.hasPermission = hasPermission;
exports.requireRole = requireRole;
exports.requireAdminAccess = requireAdminAccess;
const usersService_1 = require("../services/usersService");
exports.ROLE_PERMISSIONS = {
    'Super Admin': ['*'],
    'Admin': ['*'],
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
    'Member': []
};
function hasPermission(userRole, route) {
    const permissions = exports.ROLE_PERMISSIONS[userRole] || [];
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
function requireRole(allowedRoles) {
    return async (req, res, next) => {
        try {
            const currentUser = req.session.user;
            if (!currentUser) {
                res.redirect('/admin/login?error=Please log in to continue');
                return;
            }
            const user = await usersService_1.usersService.getUserById(currentUser.id);
            if (!user) {
                res.redirect('/admin/login?error=User not found');
                return;
            }
            if (!allowedRoles.includes(user.role)) {
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
        }
        catch (error) {
            console.error('Error in role middleware:', error);
            res.status(500).send('Internal Server Error');
        }
    };
}
function requireAdminAccess() {
    return async (req, res, next) => {
        try {
            const currentUser = req.session.user;
            if (!currentUser) {
                res.redirect('/admin/login?error=Please log in to continue');
                return;
            }
            const user = await usersService_1.usersService.getUserById(currentUser.id);
            if (!user) {
                res.redirect('/admin/login?error=User not found');
                return;
            }
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
        }
        catch (error) {
            console.error('Error in admin access middleware:', error);
            res.status(500).send('Internal Server Error');
        }
    };
}
//# sourceMappingURL=roleMiddleware.js.map