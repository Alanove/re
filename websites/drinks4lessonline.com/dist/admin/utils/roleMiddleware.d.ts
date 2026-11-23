import { Request, Response, NextFunction } from 'express';
export type UserRole = 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';
export declare const ROLE_PERMISSIONS: Record<UserRole, string[]>;
export declare function hasPermission(userRole: UserRole, route: string): boolean;
export declare function requireRole(allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function requireAdminAccess(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=roleMiddleware.d.ts.map