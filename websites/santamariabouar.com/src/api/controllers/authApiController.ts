import { Request, Response } from 'express';
import { usersService } from '../../../admin/services/usersService';
import { apartmentsService } from '../../../admin/services/apartmentsService';
import { canLoginToAdmin, isSuperAdmin } from '../../../admin/utils/roleMiddleware';
import { accessRequestService } from '../../services/accessRequestService';
import { emailService } from '../../services/emailService';
import { passwordResetService } from '../../services/passwordResetService';
import { apartmentLabel, getMemberApartments } from '../../services/memberPortalService';
import { apiTokenService, getJwtSecret, signAccessToken } from '../services/apiTokenService';
import { ApiUser } from '../types';
import { ApiError, sendData } from '../utils/apiResponse';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
}

function requireSecret(): string {
  const secret = getJwtSecret();
  if (!secret) throw new ApiError(503, 'The mobile API is not configured on this server.');
  return secret;
}

export async function buildProfile(user: ApiUser) {
  const apartments = await getMemberApartments(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    walletEnabled: Boolean(user.walletEnabled),
    isAdmin: canLoginToAdmin(user.role),
    canWriteAdmin: isSuperAdmin(user.role),
    apartments: apartments.map((apt: any) => ({
      id: apt.id,
      label: apartmentLabel(apt),
      block: apt.block,
      unitNumberOfficial: apt.unitNumberOfficial,
      unitNumberUnofficial: apt.unitNumberUnofficial,
      memberRole: apt.memberRole || 'owner',
      isPrimaryOwner: Boolean(apt.isPrimaryOwner)
    }))
  };
}

export class AuthApiController {
  static async login(req: Request, res: Response): Promise<void> {
    const secret = requireSecret();
    const login = String(req.body?.login || req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const deviceName = req.body?.deviceName ? String(req.body.deviceName) : null;

    if (!login || !password) {
      throw new ApiError(400, 'Email/phone and password are required.');
    }

    const user = await usersService.authenticateUser(login, password);
    if (!user) {
      throw new ApiError(401, 'Invalid email/phone or password.');
    }

    await usersService.recordLastLogin(user.id);
    const tokens = await apiTokenService.issueTokens(user.id, user.role, secret, deviceName);
    const profile = await buildProfile({ ...user, walletEnabled: Boolean(user.walletEnabled) });
    sendData(res, { ...tokens, user: profile });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const secret = requireSecret();
    const rotated = await apiTokenService.rotateRefreshToken(String(req.body?.refreshToken || ''));
    if (!rotated) {
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }

    const user = await usersService.getUserById(rotated.userId);
    if (!user || user.status !== 'Active') {
      await apiTokenService.revokeAllForUser(rotated.userId);
      throw new ApiError(401, 'Your account is not active.');
    }

    sendData(res, {
      accessToken: signAccessToken(user.id, user.role, secret),
      accessTokenExpiresIn: 15 * 60,
      refreshToken: rotated.refreshToken
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    await apiTokenService.revokeRefreshToken(String(req.body?.refreshToken || ''));
    sendData(res, { success: true });
  }

  static async me(req: Request, res: Response): Promise<void> {
    sendData(res, await buildProfile(req.apiUser!));
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, 'Please enter a valid email address.');
    }

    const user = await usersService.getUserByEmail(email);
    if (user && user.status === 'Active' && user.email) {
      const rawToken = await passwordResetService.createResetToken(user.id);
      await emailService.sendPasswordReset({
        to: user.email,
        fullName: user.name,
        resetUrl: `${appBaseUrl()}/account/reset-password?token=${encodeURIComponent(rawToken)}`
      });
    }

    sendData(res, { message: 'If an account exists for that email, we sent a reset link.' });
  }

  static async apartmentDirectory(_req: Request, res: Response): Promise<void> {
    const apartments = await apartmentsService.listApartmentCodes();
    sendData(res, apartments.map((apt) => ({ id: apt.id, label: apartmentLabel(apt) })));
  }

  static async requestAccess(req: Request, res: Response): Promise<void> {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const acceptTerms = req.body?.acceptTerms === true;
    const rawApartments: unknown[] = Array.isArray(req.body?.apartments) ? req.body.apartments : [];

    if (fullName.length < 2) throw new ApiError(400, 'Please enter your full name.');
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'Please enter a valid email address.');
    if (!phone) throw new ApiError(400, 'Please enter your phone number.');
    if (!acceptTerms) {
      throw new ApiError(400, 'You must accept the Privacy Policy and Terms & Conditions to continue.');
    }

    const seen = new Set<number>();
    const requested: Array<{ apartmentId: number; role: 'owner' | 'tenant' }> = [];
    for (const entry of rawApartments) {
      const record = (entry || {}) as { apartmentId?: unknown; role?: unknown };
      const apartmentId = parseInt(String(record.apartmentId ?? ''), 10);
      if (!Number.isFinite(apartmentId) || seen.has(apartmentId)) continue;
      seen.add(apartmentId);
      requested.push({ apartmentId, role: record.role === 'tenant' ? 'tenant' : 'owner' });
    }
    if (requested.length === 0) throw new ApiError(400, 'Please select at least one apartment.');

    if (await accessRequestService.hasPendingEmail(email)) {
      throw new ApiError(409, 'An access request with this email is already pending review.');
    }

    const directory = await apartmentsService.listApartmentCodes();
    const byId = new Map(directory.map((apt) => [apt.id, apt]));
    const valid = requested.filter((a) => byId.has(a.apartmentId));
    if (valid.length === 0) throw new ApiError(400, 'Please select at least one apartment.');

    const requestId = await accessRequestService.createRequest({ fullName, email, phone, apartments: valid });

    try {
      await emailService.sendAccessRequest({
        fullName,
        email,
        phone,
        apartmentLabels: valid.map((a) => {
          const label = apartmentLabel(byId.get(a.apartmentId)!);
          return `${label} (${a.role === 'tenant' ? 'Tenant' : 'Owner'})`;
        }),
        requestId
      });
    } catch (emailError) {
      console.error('Access request saved but notification email failed:', emailError);
    }

    sendData(
      res,
      { message: 'Your request has been submitted. You will receive an email once it is reviewed by the administration.' },
      201
    );
  }
}
