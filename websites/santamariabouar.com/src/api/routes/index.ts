import express, { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AuthApiController } from '../controllers/authApiController';
import { MemberApiController } from '../controllers/memberApiController';
import { AdminApiController } from '../controllers/adminApiController';
import {
  requireApiAdmin,
  requireApiConfigured,
  requireApiSuperAdmin,
  requireApiUser,
  requireApartmentAccess
} from '../middleware/apiAuth';
import {
  apiForgotPasswordRateLimiter,
  apiGeneralRateLimiter,
  apiLoginRateLimiter,
  apiRefreshRateLimiter,
  apiRequestAccessRateLimiter
} from '../middleware/apiRateLimits';
import { ApiError, asyncHandler, sendError } from '../utils/apiResponse';

const router = Router();

// Native apps send no Origin header; this only matters for the Expo web preview.
router.use(cors({ origin: true, credentials: false, allowedHeaders: ['Authorization', 'Content-Type'] }));
router.use(express.json({ limit: '1mb' }));
router.use(apiGeneralRateLimiter);
router.use(requireApiConfigured);

// ---------- Auth (public) ----------
router.post('/auth/login', apiLoginRateLimiter, asyncHandler(AuthApiController.login));
router.post('/auth/refresh', apiRefreshRateLimiter, asyncHandler(AuthApiController.refresh));
router.post('/auth/logout', asyncHandler(AuthApiController.logout));
router.post('/auth/forgot-password', apiForgotPasswordRateLimiter, asyncHandler(AuthApiController.forgotPassword));
router.get('/auth/apartments', asyncHandler(AuthApiController.apartmentDirectory));
router.post('/auth/request-access', apiRequestAccessRateLimiter, asyncHandler(AuthApiController.requestAccess));
router.get('/auth/me', requireApiUser, asyncHandler(AuthApiController.me));

// ---------- Member ----------
const me = Router();
me.use(requireApiUser);
me.get('/dashboard', asyncHandler(MemberApiController.dashboard));
me.get('/apartments', asyncHandler(MemberApiController.apartments));
me.get('/apartments/:id', requireApartmentAccess, asyncHandler(MemberApiController.apartmentDetail));
me.get('/invoices', asyncHandler(MemberApiController.invoices));
me.get('/invoices/:id/receipt', asyncHandler(MemberApiController.invoiceReceipt));
me.get('/transactions', asyncHandler(MemberApiController.transactions));
me.get('/transactions/:id/receipt', asyncHandler(MemberApiController.transactionReceipt));
me.get('/wallet', asyncHandler(MemberApiController.wallet));
me.post('/password', apiLoginRateLimiter, asyncHandler(MemberApiController.changePassword));
router.use('/me', me);

// ---------- Admin (read: Super Admin + Admin, write: Super Admin) ----------
const admin = Router();
admin.use(requireApiUser, requireApiAdmin);
admin.get('/dashboard', asyncHandler(AdminApiController.dashboard));
admin.get('/accounts', asyncHandler(AdminApiController.accounts));
admin.get('/transaction-categories', asyncHandler(AdminApiController.categories));
admin.get('/apartments', asyncHandler(AdminApiController.apartments));

admin.get('/transactions', asyncHandler(AdminApiController.transactions));
admin.get('/transactions/:id/receipt', asyncHandler(AdminApiController.transactionReceipt));
admin.post('/transactions', requireApiSuperAdmin, asyncHandler(AdminApiController.createTransaction));

admin.get('/invoices', asyncHandler(AdminApiController.invoices));
admin.get('/invoices/:id', asyncHandler(AdminApiController.invoiceDetail));
admin.get('/invoices/:id/receipt', asyncHandler(AdminApiController.invoiceReceipt));
admin.post('/invoices', requireApiSuperAdmin, asyncHandler(AdminApiController.createInvoice));
admin.post('/invoices/:id/pay', requireApiSuperAdmin, asyncHandler(AdminApiController.payInvoice));

admin.get('/wallets', asyncHandler(AdminApiController.wallets));
admin.get('/wallets/:apartmentId', asyncHandler(AdminApiController.walletDetail));
admin.post('/wallets/:apartmentId/add', requireApiSuperAdmin, asyncHandler(AdminApiController.walletAdd));
admin.post('/wallets/:apartmentId/subtract', requireApiSuperAdmin, asyncHandler(AdminApiController.walletSubtract));

admin.get('/access-requests', asyncHandler(AdminApiController.accessRequests));
admin.get('/access-requests/:id', asyncHandler(AdminApiController.accessRequestDetail));
admin.post('/access-requests/:id/approve', requireApiSuperAdmin, asyncHandler(AdminApiController.approveAccessRequest));
admin.post('/access-requests/:id/reject', requireApiSuperAdmin, asyncHandler(AdminApiController.rejectAccessRequest));
router.use('/admin', admin);

router.use((_req: Request, res: Response) => {
  sendError(res, 404, 'Not found');
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    sendError(res, error.status, error.message);
    return;
  }
  if ((error as { type?: string })?.type === 'entity.parse.failed') {
    sendError(res, 400, 'Invalid JSON body');
    return;
  }
  console.error('[api] Unhandled error:', error);
  sendError(res, 500, 'Something went wrong. Please try again.');
});

export default router;
