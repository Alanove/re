import { Router, Request, Response, NextFunction } from 'express';
import { MemberController } from '../controllers/memberController';
import { requireMember, redirectIfMember } from '../middleware/requireMember';
import { StorageService } from '../../admin/services/storageService';
import { APARTMENT_PHOTO_MAX_FILE_SIZE } from '../services/imageService';
import {
  loginRateLimiter,
  requestAccessRateLimiter,
  forgotPasswordRateLimiter,
  openGateRateLimiter
} from '../middleware/rateLimits';
import { validateCsrf } from '../middleware/csrf';
import { requireRecaptcha } from '../services/recaptchaService';

const router = Router();
const storageService = StorageService.getInstance();
const apartmentUpload = storageService.createApartmentUploadConfig();

function wantsJsonResponse(req: Request): boolean {
  return req.xhr || req.headers.accept?.includes('application/json') === true;
}

function handleApartmentPhotoUpload(req: Request, res: Response, next: NextFunction): void {
  apartmentUpload.array('photos', 20)(req, res, (err: any) => {
    if (!err) {
      next();
      return;
    }

    const apartmentId = req.params.id;
    let message = 'Upload failed.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `Each image must be ${APARTMENT_PHOTO_MAX_FILE_SIZE / (1024 * 1024)} MB or smaller.`;
    } else if (err.message) {
      message = err.message;
    }

    if (wantsJsonResponse(req)) {
      res.status(400).json({ success: false, message });
      return;
    }

    res.redirect(`/account/apartments/${apartmentId}?error=` + encodeURIComponent(message));
  });
}

router.get('/', requireMember, MemberController.index);
router.post('/open-gate', requireMember, openGateRateLimiter, validateCsrf, MemberController.openGate);
router.get('/profile', requireMember, MemberController.profile);
router.post('/profile', requireMember, MemberController.updateProfile);
router.get('/apartments', requireMember, MemberController.apartments);
router.get('/parking', requireMember, MemberController.parking);
router.get('/payments', requireMember, MemberController.payments);
router.get('/transactions', requireMember, MemberController.transactions);
router.get('/transactions/:id/receipt', requireMember, MemberController.transactionReceipt);
router.get('/invoices/:id/payment-receipt', requireMember, MemberController.invoicePaymentReceipt);
router.get('/transactions-chronological', requireMember, MemberController.reportsChronological);
router.get('/transactions-by-category', requireMember, MemberController.reportsByCategory);
router.get('/wallet', requireMember, MemberController.wallet);
router.get('/gate-access', requireMember, MemberController.gateAccess);
router.get('/gate-access/request', requireMember, MemberController.gateAccessRequestForm);
router.post('/gate-access/request', requireMember, MemberController.requestGateAccess);
router.post('/gate-access', requireMember, MemberController.requestGateAccess);
router.get('/settings', requireMember, MemberController.settings);
router.post('/settings/password', requireMember, MemberController.changePassword);

router.get('/login', redirectIfMember, MemberController.login);
router.post(
  '/login',
  redirectIfMember,
  loginRateLimiter,
  validateCsrf,
  requireRecaptcha,
  MemberController.loginPost
);
router.get('/logout', MemberController.logout);
router.post('/stop-impersonating', validateCsrf, MemberController.stopImpersonating);

router.get('/auth/google', MemberController.googleStart);
router.get('/auth/google/callback', MemberController.googleCallback);

router.get('/request-access', redirectIfMember, MemberController.requestAccess);
router.post(
  '/request-access',
  redirectIfMember,
  requestAccessRateLimiter,
  validateCsrf,
  requireRecaptcha,
  MemberController.requestAccessPost
);

router.get('/forgot-password', redirectIfMember, MemberController.forgotPassword);
router.post(
  '/forgot-password',
  redirectIfMember,
  forgotPasswordRateLimiter,
  validateCsrf,
  requireRecaptcha,
  MemberController.forgotPasswordPost
);
router.get('/reset-password', redirectIfMember, MemberController.resetPassword);
router.post(
  '/reset-password',
  redirectIfMember,
  forgotPasswordRateLimiter,
  validateCsrf,
  MemberController.resetPasswordPost
);

router.get('/apartments/:id', requireMember, MemberController.apartmentDetail);
router.post(
  '/apartments/:id/photos',
  requireMember,
  handleApartmentPhotoUpload,
  MemberController.uploadPhoto
);
router.post(
  '/apartments/:id/photos/delete',
  requireMember,
  MemberController.deletePhoto
);
router.post(
  '/apartments/:id/photos/set-default',
  requireMember,
  MemberController.setDefaultPhoto
);
router.post('/apartments/:id/listing', requireMember, MemberController.requestListing);
router.post('/apartments/:id/listing/remove', requireMember, MemberController.removeListing);
router.post('/apartments/:id/tenant', requireMember, MemberController.manageTenant);
router.post('/apartments/:id/gate-access', requireMember, MemberController.requestGateAccess);

export default router;
