import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { usersService } from '../../admin/services/usersService';
import { apartmentsService } from '../../admin/services/apartmentsService';
import { InvoicesService } from '../../admin/services/invoicesService';
import { TransactionsService } from '../../admin/services/transactionsService';
import { ApartmentWalletService } from '../../admin/services/apartmentWalletService';
import { InvoiceTransactionsService } from '../../admin/services/invoiceTransactionsService';
import { TransactionCategoriesService } from '../../admin/services/transactionCategoriesService';
import { AccountsService } from '../../admin/services/accountsService';
import { isHiddenFromReports } from '../../admin/services/transactionReportFilters';
import { TransactionsController } from '../../admin/controllers/transactionsController';
import { InvoicesController } from '../../admin/controllers/invoicesController';
import { PagesService } from '../../admin/services/pagesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { PaymentsService } from '../../admin/services/paymentsService';
import { accessRequestService } from '../services/accessRequestService';
import { memberRequestsService } from '../services/memberRequestsService';
import { apartmentListingsService } from '../services/apartmentListingsService';
import { parseListingFormBody, validateListingForm } from '../utils/listingForm';
import { emailService } from '../services/emailService';
import { passwordResetService } from '../services/passwordResetService';
import { APARTMENT_PHOTO_MAX_WIDTH, APARTMENT_PHOTO_MAX_FILE_SIZE, resizeImageToMaxWidth } from '../services/imageService';
import { getApartmentDirPath } from '../constants/data-paths';
import { getMemberSession, safeAccountRedirect } from '../middleware/requireMember';
import { googleCallbackCanAuthenticate, passport } from '../config/passport';
import { regenerateSession, destroySession, saveSession } from '../utils/sessionHelpers';
import { getRecaptchaSiteKey } from '../services/recaptchaService';
import { GateBusyError, openGateWithLock } from '../services/gate/openGate';
import { gateOpenLogService } from '../services/gateOpenLogService';
import { PARKING_PLAN_IMAGE_URL, parkingMapService } from '../services/parkingMapService';
import {
  apartmentLabel,
  assertMemberApartment,
  getMemberApartments,
  loadPaymentsDueForMember,
  loadPaymentInstructionLocals
} from '../services/memberPortalService';

function getAppBaseUrl(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
}

const invoicesService = InvoicesService.getInstance();
const transactionsService = TransactionsService.getInstance();
const apartmentWalletService = ApartmentWalletService.getInstance();
const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
const categoriesService = TransactionCategoriesService.getInstance();
const accountsService = AccountsService.getInstance();
const pagesService = PagesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const paymentsService = PaymentsService.getInstance();

const MIN_PASSWORD_LENGTH = 8;

function apartmentLabelWithRole(
  apt: { block?: string; unitNumberOfficial?: string; unitNumberUnofficial?: string },
  role: 'owner' | 'tenant'
): string {
  const roleLabel = role === 'tenant' ? 'Tenant' : 'Owner';
  return `${apartmentLabel(apt)} (${roleLabel})`;
}

async function loadParkingMap(apartments: Array<{
  id: number;
  block?: string;
  unitNumberOfficial?: string;
  unitNumberUnofficial?: string;
}>) {
  try {
    return await parkingMapService.highlightsFor(apartments);
  } catch (error) {
    console.error('Error loading parking map:', error);
    return {
      highlights: [],
      unmarkedLabels: apartments.map((apt) => apartmentLabel(apt)),
      imageUrl: PARKING_PLAN_IMAGE_URL
    };
  }
}

function parseAccessRequestApartments(body: Record<string, unknown>): Array<{ apartmentId: number; role: 'owner' | 'tenant' }> {
  let apartmentIds: number[] = [];
  const rawIds = body.apartmentIds;
  if (Array.isArray(rawIds)) {
    apartmentIds = rawIds.map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n));
  } else if (rawIds) {
    apartmentIds = [parseInt(String(rawIds), 10)].filter((n) => !Number.isNaN(n));
  }

  const normalizeRole = (value: unknown): 'owner' | 'tenant' =>
    String(value || '').toLowerCase() === 'tenant' ? 'tenant' : 'owner';

  // Prefer parallel arrays: apartmentIds[i] <-> apartmentRoles[i]
  // (Express 5 qs arrayLimit collapses apartmentRoles[97] into ["tenant"], losing the id key.)
  const rolesRaw = body.apartmentRoles;
  let rolesList: Array<'owner' | 'tenant'> | null = null;
  if (Array.isArray(rolesRaw)) {
    rolesList = rolesRaw.map(normalizeRole);
  } else if (typeof rolesRaw === 'string') {
    rolesList = [normalizeRole(rolesRaw)];
  }

  const roleById: Record<number, 'owner' | 'tenant'> = {};
  if (rolesRaw && typeof rolesRaw === 'object' && !Array.isArray(rolesRaw)) {
    for (const [key, value] of Object.entries(rolesRaw as Record<string, unknown>)) {
      const id = parseInt(String(key), 10);
      if (Number.isNaN(id)) continue;
      roleById[id] = normalizeRole(value);
    }
  }

  const seen = new Set<number>();
  const apartments: Array<{ apartmentId: number; role: 'owner' | 'tenant' }> = [];
  apartmentIds.forEach((apartmentId, index) => {
    if (seen.has(apartmentId)) return;
    seen.add(apartmentId);
    const roleFromList = rolesList && index < rolesList.length ? rolesList[index] : undefined;
    apartments.push({
      apartmentId,
      role: roleFromList || roleById[apartmentId] || 'owner'
    });
  });
  return apartments;
}

const GOOGLE_NO_MEMBER_MESSAGE =
  'No member account found for that Google email. Request access first, or use the same email that was approved.';
const GOOGLE_RETRY_MESSAGE =
  "Google sign-in didn't finish. Please try Continue with Google again.";
const GOOGLE_FAILED_MESSAGE = 'Google login failed. Please try again.';
const GOOGLE_ATTEMPT_TTL_MS = 60_000;
const GOOGLE_ATTEMPT_WAIT_MS = 30_000;
const GOOGLE_ATTEMPT_REGISTER_WAIT_MS = 3_000;

interface GoogleMemberIdentity {
  id: number;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface GoogleAuthInfo {
  reason?: string;
  message?: string;
}

interface GoogleAttemptResult {
  err?: unknown;
  user?: GoogleMemberIdentity;
  info?: GoogleAuthInfo;
}

const googleAttempts = new Map<string, Promise<GoogleAttemptResult>>();

function googleQueryString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function normalizeGoogleInfo(info: unknown): GoogleAuthInfo | undefined {
  if (!info || typeof info !== 'object') return undefined;
  const record = info as { reason?: unknown; message?: unknown };
  const normalized: GoogleAuthInfo = {};
  if (typeof record.reason === 'string' && record.reason) normalized.reason = record.reason;
  if (typeof record.message === 'string' && record.message) normalized.message = record.message;
  return normalized.reason || normalized.message ? normalized : undefined;
}

function beginGoogleAttempt(code: string): {
  leader: boolean;
  promise: Promise<GoogleAttemptResult>;
  settle?: (result: GoogleAttemptResult) => void;
} {
  const existing = googleAttempts.get(code);
  if (existing) {
    return { leader: false, promise: existing };
  }

  let settle!: (result: GoogleAttemptResult) => void;
  const promise = new Promise<GoogleAttemptResult>((resolve) => {
    settle = resolve;
  });
  googleAttempts.set(code, promise);
  setTimeout(() => {
    if (googleAttempts.get(code) === promise) {
      googleAttempts.delete(code);
    }
  }, GOOGLE_ATTEMPT_TTL_MS);

  return { leader: true, promise, settle };
}

function waitForGoogleAttempt(promise: Promise<GoogleAttemptResult>): Promise<GoogleAttemptResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for Google sign-in'));
    }, GOOGLE_ATTEMPT_WAIT_MS);
    promise.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isGooglePrefetch(req: Request): boolean {
  const purpose = `${req.get('purpose') || ''} ${req.get('sec-purpose') || ''}`.toLowerCase();
  return purpose.includes('prefetch') || purpose.includes('prerender');
}

function isGoogleCallbackNavigation(req: Request): boolean {
  const mode = req.get('sec-fetch-mode');
  const dest = req.get('sec-fetch-dest');
  if (!mode && !dest) return true;
  return mode === 'navigate' || dest === 'document';
}

function waitForRegisteredGoogleAttempt(code: string): Promise<GoogleAttemptResult> {
  const existing = googleAttempts.get(code);
  if (existing) return waitForGoogleAttempt(existing);

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const attempt = googleAttempts.get(code);
      if (attempt) {
        clearInterval(timer);
        waitForGoogleAttempt(attempt).then(resolve, reject);
        return;
      }
      if (Date.now() - started >= GOOGLE_ATTEMPT_REGISTER_WAIT_MS) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for Google sign-in'));
      }
    }, 50);
  });
}

function ignoreGoogleCallbackProbe(req: Request, res: Response): void {
  // express-session skips Set-Cookie when the session is null.
  // 204 is safe here because this request is not the page the user is looking at.
  (req as unknown as { session: Request['session'] | null }).session = null;
  res.status(204).end();
}

function gateAccessRecipientEmails(ownerEmail?: string | null, targetEmail?: string | null): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of [ownerEmail, targetEmail]) {
    const email = String(raw || '').trim();
    if (!email.includes('@')) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

export class MemberController {
  static googleAuthEnabled(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  private static async loadMemberOrRedirect(req: Request, res: Response) {
    const sessionMember = getMemberSession(req);
    if (!sessionMember) {
      res.redirect('/account/login');
      return null;
    }
    const user = await usersService.getUserById(sessionMember.id);
    if (!user) {
      delete req.session.member;
      res.redirect('/account/login');
      return null;
    }
    return user;
  }

  private static shellLocals(activeNav: string, member: any, extras: Record<string, any> = {}) {
    return {
      member,
      activeNav,
      layout: 'layout',
      ...extras
    };
  }

  static async index(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const welcomePage = await pagesService.getPageBySlug('account-welcome');
      const [apartments, paymentsDue, paymentLocals] = await Promise.all([
        getMemberApartments(user.id),
        loadPaymentsDueForMember(user.id),
        loadPaymentInstructionLocals()
      ]);

      res.render(
        'account/home',
        MemberController.shellLocals('home', user, {
          pageTitle: welcomePage?.title || 'My Account',
          welcomeTitle: welcomePage?.title || 'Welcome to Santa Maria Bouar',
          welcomeContent: welcomePage?.content || '',
          apartments,
          paymentsDue,
          includeBootstrap: true,
          pageScript: '/js/account-open-gate.js',
          ...paymentLocals
        })
      );
    } catch (error) {
      console.error('Error loading account home:', error);
      res.status(500).send('Unable to load account');
    }
  }

  static async openGate(req: Request, res: Response): Promise<void> {
    const sessionMember = getMemberSession(req);
    if (!sessionMember) {
      res.status(401).json({ success: false, message: 'Please sign in.' });
      return;
    }

    const user = await usersService.getUserById(sessionMember.id);
    if (!user) {
      res.status(401).json({ success: false, message: 'Please sign in.' });
      return;
    }

    const impersonator = req.session.impersonator || null;
    const ipAddress = String(req.ip || req.socket.remoteAddress || '').slice(0, 45);

    const logAttempt = async (
      status: 'success' | 'failed',
      extras: { errorMessage?: string; host?: string }
    ) => {
      try {
        await gateOpenLogService.insert({
          userId: user.id,
          userName: user.name,
          userEmail: user.email || null,
          userPhone: user.phone || null,
          status,
          errorMessage: extras.errorMessage || null,
          host: extras.host || null,
          ipAddress,
          impersonatorId: impersonator?.id || null,
          impersonatorName: impersonator?.name || null
        });
      } catch (logError) {
        console.error('Failed to write gate open log:', logError);
      }
    };

    try {
      const result = await openGateWithLock();
      await logAttempt('success', { host: result.host });
      res.json({ success: true, message: 'The main gate is opening.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the gate.';
      const statusCode = error instanceof GateBusyError ? 429 : 503;
      console.error('Open gate failed:', message);
      await logAttempt('failed', { errorMessage: message });
      res.status(statusCode).json({ success: false, message });
    }
  }

  static async profile(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      res.render(
        'account/profile',
        MemberController.shellLocals('profile', user, {
          pageTitle: 'My Profile',
          success: req.query.success,
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading profile:', error);
      res.status(500).send('Unable to load profile');
    }
  }

  static async apartments(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const apartments = await getMemberApartments(user.id);
      res.render(
        'account/apartments',
        MemberController.shellLocals('apartments', user, {
          pageTitle: 'My Apartments',
          apartments,
          success: req.query.success,
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading apartments:', error);
      res.status(500).send('Unable to load apartments');
    }
  }

  static async parking(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const apartments = await getMemberApartments(user.id);
      const parkingMap = await loadParkingMap(apartments);
      res.render(
        'account/parking',
        MemberController.shellLocals('parking', user, {
          pageTitle: 'Parking',
          parkingMap
        })
      );
    } catch (error) {
      console.error('Error loading parking:', error);
      res.status(500).send('Unable to load parking');
    }
  }

  static async payments(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const [paymentsDue, paymentLocals] = await Promise.all([
        loadPaymentsDueForMember(user.id),
        loadPaymentInstructionLocals()
      ]);

      res.render(
        'account/payments',
        MemberController.shellLocals('payments', user, {
          pageTitle: 'Payments Due',
          paymentsDue,
          ...paymentLocals
        })
      );
    } catch (error) {
      console.error('Error loading payments:', error);
      res.status(500).send('Unable to load payments');
    }
  }

  static async transactions(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const apartments = await getMemberApartments(user.id);
      const transactions: any[] = [];

      for (const apt of apartments) {
        const label = apartmentLabel(apt);
        const txs = await transactionsService.getFilteredTransactions({ apartmentId: apt.id });
        txs.forEach((tx) => {
          transactions.push({
            ...tx,
            apartmentLabel: label,
            isWalletPayment: false
          });
        });

        const walletPayments = await invoiceTransactionsService.getWalletPaymentsByApartmentId(apt.id);
        walletPayments.forEach((wp) => {
          const invoiceDesc = wp.invoiceDescription || `Invoice #${wp.invoiceId}`;
          transactions.push({
            id: `wallet-${wp.id}`,
            invoiceId: wp.invoiceId,
            amount: wp.amount,
            type: 'income',
            date: wp.date,
            description: `Wallet payment — ${invoiceDesc}`,
            receiptGenerated: true,
            apartmentLabel: label,
            isWalletPayment: true,
            walletAmount: wp.amount
          });
        });
      }

      transactions.sort((a, b) => String(b.date).localeCompare(String(a.date)));

      res.render(
        'account/transactions',
        MemberController.shellLocals('transactions', user, {
          pageTitle: 'Payment History',
          transactions
        })
      );
    } catch (error) {
      console.error('Error loading transactions:', error);
      res.status(500).send('Unable to load transactions');
    }
  }

  static async transactionReceipt(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      const redirect = encodeURIComponent(req.originalUrl || '/account/transactions');
      res.redirect(`/account/login?redirect=${redirect}`);
      return;
    }

    const transactionId = parseInt(req.params.id, 10);
    if (Number.isNaN(transactionId)) {
      res.status(404).send('Receipt not found');
      return;
    }

    try {
      const transaction = await transactionsService.getTransactionById(transactionId);
      if (
        !transaction ||
        transaction.type !== 'income' ||
        !transaction.receiptGenerated ||
        !transaction.apartmentId
      ) {
        res.status(404).send('Receipt not found');
        return;
      }

      const apartment = await assertMemberApartment(member.id, transaction.apartmentId);
      if (!apartment) {
        res.status(403).send('You do not have access to this receipt');
        return;
      }

      // Reuse the existing printable receipt renderer after enforcing member ownership.
      await TransactionsController.generateReceipt(req, res);
    } catch (error) {
      console.error('Error loading member receipt:', error);
      res.status(500).send('Unable to load receipt');
    }
  }

  static async invoicePaymentReceipt(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      const redirect = encodeURIComponent(req.originalUrl || '/account/payments');
      res.redirect(`/account/login?redirect=${redirect}`);
      return;
    }

    const invoiceId = parseInt(req.params.id, 10);
    if (Number.isNaN(invoiceId)) {
      res.status(404).send('Receipt not found');
      return;
    }

    try {
      const invoice = await invoicesService.getInvoiceById(invoiceId);
      if (!invoice) {
        res.status(404).send('Invoice not found');
        return;
      }

      const apartment = await assertMemberApartment(member.id, invoice.apartmentId);
      if (!apartment) {
        res.status(403).send('You do not have access to this receipt');
        return;
      }

      await InvoicesController.paymentReceipt(req, res);
    } catch (error) {
      console.error('Error loading member invoice payment receipt:', error);
      res.status(500).send('Unable to load receipt');
    }
  }

  static async gateAccess(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const ownedApartments = await getMemberApartments(user.id);
      const apartmentIds = ownedApartments.map((apt) => apt.id);
      const labelById = new Map(ownedApartments.map((apt) => [apt.id, apartmentLabel(apt)]));

      const [gateAccessMap, pendingGate, appInfoPage] = await Promise.all([
        apartmentsService.getGateAccessUsersByApartmentIds(apartmentIds),
        memberRequestsService.getPendingGateRequestsForApartments(apartmentIds),
        pagesService.getPageBySlug('account-gate-access')
      ]);

      const gateAccessEntries: Array<{
        apartmentId: number;
        apartmentLabel: string;
        id: number;
        name: string;
        phone?: string;
        relation: string;
        expiryDate?: string | null;
      }> = [];

      for (const apt of ownedApartments) {
        const people = gateAccessMap.get(apt.id) || [];
        for (const person of people) {
          gateAccessEntries.push({
            apartmentId: apt.id,
            apartmentLabel: labelById.get(apt.id) || apartmentLabel(apt),
            id: person.id,
            name: person.name,
            phone: person.phone,
            relation: person.relation,
            expiryDate: person.expiryDate
          });
        }
      }

      const pendingWithLabels = pendingGate.map((g) => ({
        ...g,
        apartmentLabel: g.apartmentLabel || labelById.get(g.apartmentId) || `Apartment #${g.apartmentId}`
      }));

      res.render(
        'account/gate-access',
        MemberController.shellLocals('gate-access', user, {
          pageTitle: 'Main Gate Access',
          gateAccessContent: appInfoPage?.content || '',
          ownedApartments: ownedApartments.map((apt) => ({
            id: apt.id,
            label: apartmentLabel(apt)
          })),
          gateAccessEntries,
          pendingGate: pendingWithLabels,
          success: req.query.success,
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading gate access:', error);
      res.status(500).send('Unable to load main gate access');
    }
  }

  static async gateAccessRequestForm(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const ownedApartments = await getMemberApartments(user.id);
      const selectedApartmentId = parseInt(String(req.query.apartmentId || ''), 10);

      res.render(
        'account/gate-access-request',
        MemberController.shellLocals('gate-access', user, {
          pageTitle: 'Request New Access',
          ownedApartments: ownedApartments.map((apt) => ({
            id: apt.id,
            label: apartmentLabel(apt)
          })),
          selectedApartmentId: Number.isNaN(selectedApartmentId) ? '' : selectedApartmentId,
          gateRelations: apartmentsService.getGateAccessRelations().filter((r) => r !== 'Owner'),
          formValues: {},
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading gate access request form:', error);
      res.status(500).send('Unable to load gate access request form');
    }
  }

  static async wallet(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const walletEnabled = Boolean(user.walletEnabled);
      const wallets: any[] = [];
      let totalWallet = 0;

      if (walletEnabled) {
        const apartments = await getMemberApartments(user.id);

        for (const apt of apartments) {
          const balance = await apartmentWalletService.getTotalBalance(apt.id);
          const statement = await apartmentWalletService.getWalletStatement(apt.id);
          totalWallet += balance;
          wallets.push({
            apartment: apt,
            apartmentLabel: apartmentLabel(apt),
            balance,
            entries: statement.entries
          });
        }
      }

      res.render(
        'account/wallet',
        MemberController.shellLocals('wallet', user, {
          pageTitle: 'Wallet',
          walletEnabled,
          wallets,
          totalWallet
        })
      );
    } catch (error) {
      console.error('Error loading wallet:', error);
      res.status(500).send('Unable to load wallet');
    }
  }

  /**
   * Compound-wide transactions report (all apartments), filtered by year.
   * Includes all income/expense types; hides transfers and wallet adjustments.
   */
  private static async buildMemberReport(_user: any, yearParam?: string) {
    const currentYear = new Date().getFullYear();
    const selectedYear = yearParam && yearParam !== '' ? yearParam : String(currentYear);

    let fromDate: string | undefined;
    let toDate: string | undefined;
    if (selectedYear !== 'all') {
      const y = parseInt(selectedYear, 10);
      if (!Number.isNaN(y)) {
        fromDate = `${y}-01-01`;
        toDate = `${y}-12-31`;
      }
    }

    const [rawTransactions, apartments, categories, accounts, availableYearsRaw] = await Promise.all([
      fromDate && toDate
        ? transactionsService.getTransactionsByDateRange(fromDate, toDate)
        : fromDate
          ? transactionsService.getTransactionsByDateRange(fromDate, new Date().toISOString().split('T')[0]!)
          : toDate
            ? transactionsService.getTransactionsByDateRange('2000-01-01', toDate)
            : transactionsService.getAllTransactions(),
      apartmentsService.getAllApartments(),
      categoriesService.getAllCategories(),
      accountsService.getAllAccounts(),
      transactionsService.getAvailableYears()
    ]);

    const apartmentMap = new Map(apartments.map((a: any) => [a.id, a]));
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

    const transactions = rawTransactions.map((tx: any) => {
      const apt = tx.apartmentId ? apartmentMap.get(tx.apartmentId) : null;
      const category = categoryMap.get(tx.categoryId);
      const account = accountMap.get(tx.accountId);
      return {
        ...tx,
        apartmentLabel: apt ? apartmentLabel(apt) : '—',
        categoryName: category ? category.name : 'Uncategorized',
        categoryColor: category ? category.color : '#999999',
        accountName: account ? account.name : 'Unknown Account'
      };
    });

    // Hide transfers and wallet adjustments; keep all other income/expense types.
    const visibleTransactions = transactions.filter((t) => !isHiddenFromReports(t));

    let availableYears = availableYearsRaw.slice();
    if (!availableYears.includes(currentYear)) {
      availableYears = [currentYear, ...availableYears].sort((a, b) => b - a);
    }

    return { selectedYear, availableYears, transactions: visibleTransactions };
  }

  static async reportsChronological(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const { selectedYear, availableYears, transactions } = await MemberController.buildMemberReport(
        user,
        req.query.year as string | undefined
      );

      const sorted = transactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const totalIncome = sorted
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalExpenses = sorted
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      res.render(
        'account/report-chronological',
        MemberController.shellLocals('report-chronological', user, {
          pageTitle: 'All Compound Payments',
          transactions: sorted,
          totalIncome,
          totalExpenses,
          balance: totalIncome - totalExpenses,
          transactionCount: sorted.length,
          selectedYear,
          availableYears
        })
      );
    } catch (error) {
      console.error('Error loading chronological report:', error);
      res.status(500).send('Unable to load report');
    }
  }

  static async reportsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      const { selectedYear, availableYears, transactions } = await MemberController.buildMemberReport(
        user,
        req.query.year as string | undefined
      );

      const groupedByCategory: { [key: string]: any[] } = {};
      transactions.forEach((tx) => {
        const key = tx.categoryName || 'Uncategorized';
        if (!groupedByCategory[key]) groupedByCategory[key] = [];
        groupedByCategory[key].push(tx);
      });

      const categoryTotals: {
        [key: string]: { income: number; expense: number; balance: number; color: string };
      } = {};
      Object.keys(groupedByCategory).forEach((key) => {
        const list = groupedByCategory[key];
        const income = list
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const expense = list
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        categoryTotals[key] = {
          income,
          expense,
          balance: income - expense,
          color: list[0]?.categoryColor || '#999999'
        };
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      const sortedCategories = Object.keys(groupedByCategory).sort();

      res.render(
        'account/report-by-category',
        MemberController.shellLocals('report-by-category', user, {
          pageTitle: 'Payments by Category',
          groupedByCategory,
          categoryTotals,
          sortedCategories,
          selectedYear,
          availableYears
        })
      );
    } catch (error) {
      console.error('Error loading category report:', error);
      res.status(500).send('Unable to load report');
    }
  }

  static login(req: Request, res: Response): void {
    const redirect = safeAccountRedirect(req.query.redirect);
    (res.locals as any).includeRecaptcha = true;
    res.render('account/login', {
      pageTitle: 'My Account Login',
      error: req.query.error,
      success: req.query.success,
      redirect,
      googleAuthEnabled: MemberController.googleAuthEnabled(),
      recaptchaSiteKey: getRecaptchaSiteKey()
    });
  }

  static async loginPost(req: Request, res: Response): Promise<void> {
    const redirect = safeAccountRedirect(req.body.redirect) || safeAccountRedirect(req.query.redirect);
    const renderLoginError = (error: string) => {
      (res.locals as any).includeRecaptcha = true;
      res.render('account/login', {
        pageTitle: 'My Account Login',
        error,
        redirect,
        googleAuthEnabled: MemberController.googleAuthEnabled(),
        recaptchaSiteKey: getRecaptchaSiteKey()
      });
    };

    try {
      const login = String(req.body.login || req.body.email || '').trim();
      const password = String(req.body.password || '');

      if (!login || !password) {
        renderLoginError('Email/phone and password are required.');
        return;
      }

      const user = await usersService.authenticateUser(login, password);
      if (!user) {
        renderLoginError('Invalid email/phone or password.');
        return;
      }

      await regenerateSession(req);
      req.session.member = {
        id: user.id,
        name: user.name,
        role: user.role,
        ...(user.email ? { email: user.email } : {}),
        ...(user.phone ? { phone: user.phone } : {})
      };
      await usersService.recordLastLogin(user.id);

      res.redirect(redirect || '/account');
    } catch (error) {
      console.error('Member login error:', error);
      renderLoginError('Login failed. Please try again.');
    }
  }

  static googleStart(req: Request, res: Response, next: NextFunction): void {
    if (!MemberController.googleAuthEnabled()) {
      res.redirect('/account/login?error=' + encodeURIComponent('Google login is not configured.'));
      return;
    }
    if (isGooglePrefetch(req)) {
      ignoreGoogleCallbackProbe(req, res);
      return;
    }
    const redirect = safeAccountRedirect(req.query.redirect);
    if (redirect) {
      (req.session as any).memberLoginRedirect = redirect;
    } else {
      delete (req.session as any).memberLoginRedirect;
    }
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
  }

  static googleCallback(req: Request, res: Response, next: NextFunction): void {
    if (!MemberController.googleAuthEnabled()) {
      res.redirect('/account/login?error=' + encodeURIComponent('Google login is not configured.'));
      return;
    }

    // Prefetch and non-document probes must not exchange the code or replace the session cookie.
    if (isGooglePrefetch(req) || !isGoogleCallbackNavigation(req)) {
      ignoreGoogleCallbackProbe(req, res);
      return;
    }

    const code = googleQueryString(req.query.code);
    const state = googleQueryString(req.query.state);
    if (code && !googleCallbackCanAuthenticate(req, state)) {
      waitForRegisteredGoogleAttempt(code)
        .then((result) => MemberController.applyGoogleResult(req, res, result))
        .catch((waitErr) => {
          console.error('Google auth wait error:', waitErr);
          MemberController.finishGoogleFailure(req, res, undefined, waitErr);
        });
      return;
    }

    if (code) {
      const attempt = beginGoogleAttempt(code);
      if (!attempt.leader) {
        waitForGoogleAttempt(attempt.promise)
          .then((result) => MemberController.applyGoogleResult(req, res, result))
          .catch((waitErr) => {
            console.error('Google auth wait error:', waitErr);
            MemberController.finishGoogleFailure(req, res, undefined, waitErr);
          });
        return;
      }

      passport.authenticate('google', { session: false }, (err: unknown, user: GoogleMemberIdentity | false, info: unknown) => {
        const result: GoogleAttemptResult = {
          ...(err ? { err } : {}),
          ...(user ? { user } : {}),
          info: normalizeGoogleInfo(info)
        };
        attempt.settle?.(result);
        MemberController.applyGoogleResult(req, res, result);
      })(req, res, next);
      return;
    }

    passport.authenticate('google', { session: false }, (err: unknown, user: GoogleMemberIdentity | false, info: unknown) => {
      MemberController.applyGoogleResult(req, res, {
        ...(err ? { err } : {}),
        ...(user ? { user } : {}),
        info: normalizeGoogleInfo(info)
      });
    })(req, res, next);
  }

  private static applyGoogleResult(req: Request, res: Response, result: GoogleAttemptResult): void {
    if (result.err || !result.user) {
      MemberController.finishGoogleFailure(req, res, result.info, result.err);
      return;
    }
    MemberController.completeGoogleLogin(req, res, result.user);
  }

  private static finishGoogleFailure(
    req: Request,
    res: Response,
    info?: GoogleAuthInfo,
    err?: unknown
  ): void {
    if (err) {
      console.error('Google auth error:', err);
    } else {
      console.warn('Google auth failed:', info?.reason || info?.message || 'unknown');
    }

    if (req.session?.member?.id) {
      const pending = safeAccountRedirect(req.session.memberLoginRedirect) || '/account';
      res.redirect(pending);
      return;
    }

    if (info?.reason === 'no-member') {
      res.redirect('/account/login?error=' + encodeURIComponent(GOOGLE_NO_MEMBER_MESSAGE));
      return;
    }

    const message = err ? GOOGLE_FAILED_MESSAGE : GOOGLE_RETRY_MESSAGE;
    res.redirect('/account/login?error=' + encodeURIComponent(message));
  }

  private static completeGoogleLogin(req: Request, res: Response, user: GoogleMemberIdentity): void {
    const pendingRedirect = safeAccountRedirect(req.session.memberLoginRedirect);
    delete req.session.memberLoginRedirect;

    regenerateSession(req)
      .then(async () => {
        req.session.member = {
          id: user.id,
          name: user.name,
          role: user.role,
          ...(user.email ? { email: user.email } : {}),
          ...(user.phone ? { phone: user.phone } : {})
        };
        await usersService.recordLastLogin(user.id);
        await saveSession(req);
        res.redirect(pendingRedirect || '/account');
      })
      .catch((regenErr) => {
        console.error('Session regenerate error after Google login:', regenErr);
        res.redirect('/account/login?error=' + encodeURIComponent(GOOGLE_FAILED_MESSAGE));
      });
  }

  static async stopImpersonating(req: Request, res: Response): Promise<void> {
    const impersonator = req.session?.impersonator;
    if (!impersonator?.id) {
      res.redirect('/account');
      return;
    }

    try {
      await regenerateSession(req);
      req.session.user = {
        id: impersonator.id,
        name: impersonator.name,
        role: impersonator.role,
        ...(impersonator.email ? { email: impersonator.email } : {}),
        ...(impersonator.phone ? { phone: impersonator.phone } : {})
      };
      res.redirect('/admin/users');
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      res.redirect('/account');
    }
  }

  static logout(req: Request, res: Response): void {
    if (req.session?.impersonator?.id) {
      MemberController.stopImpersonating(req, res).catch((err) => {
        console.error('Error exiting impersonation on logout:', err);
        res.redirect('/admin/users');
      });
      return;
    }

    destroySession(req)
      .catch((err) => console.error('Error destroying member session:', err))
      .finally(() => {
        res.redirect('/account/login?success=' + encodeURIComponent('You have been logged out.'));
      });
  }

  static forgotPassword(req: Request, res: Response): void {
    (res.locals as any).includeRecaptcha = true;
    res.render('account/forgot-password', {
      pageTitle: 'Forgot Password',
      error: null,
      success: null,
      email: '',
      recaptchaSiteKey: getRecaptchaSiteKey()
    });
  }

  static async forgotPasswordPost(req: Request, res: Response): Promise<void> {
    (res.locals as any).includeRecaptcha = true;
    const email = String(req.body.email || '').trim().toLowerCase();
    const genericSuccess =
      'If an account exists for that email, we sent a reset link.';

    const renderForgot = (opts: { error?: string | null; success?: string | null; email?: string }) => {
      res.render('account/forgot-password', {
        pageTitle: 'Forgot Password',
        error: opts.error ?? null,
        success: opts.success ?? null,
        email: opts.email ?? email,
        recaptchaSiteKey: getRecaptchaSiteKey()
      });
    };

    if (!email || !email.includes('@')) {
      renderForgot({ error: 'Please enter a valid email address.' });
      return;
    }

    try {
      const user = await usersService.getUserByEmail(email);
      if (user && user.status === 'Active' && user.email) {
        const rawToken = await passwordResetService.createResetToken(user.id);
        const resetUrl = `${getAppBaseUrl()}/account/reset-password?token=${encodeURIComponent(rawToken)}`;
        await emailService.sendPasswordReset({
          to: user.email,
          fullName: user.name,
          resetUrl
        });
      }
      renderForgot({ success: genericSuccess, email: '' });
    } catch (error) {
      console.error('Forgot password error:', error);
      renderForgot({ error: 'Unable to process your request. Please try again later.' });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    const token = String(req.query.token || '').trim();

    const renderReset = (opts: {
      error?: string | null;
      token?: string;
      tokenValid: boolean;
    }) => {
      res.render('account/reset-password', {
        pageTitle: 'Reset Password',
        error: opts.error ?? null,
        token: opts.token ?? token,
        tokenValid: opts.tokenValid
      });
    };

    if (!token) {
      renderReset({
        error: 'This reset link is invalid or has expired.',
        tokenValid: false
      });
      return;
    }

    try {
      const record = await passwordResetService.findValidToken(token);
      if (!record) {
        renderReset({
          error: 'This reset link is invalid or has expired.',
          tokenValid: false
        });
        return;
      }
      renderReset({ tokenValid: true });
    } catch (error) {
      console.error('Reset password form error:', error);
      renderReset({
        error: 'Unable to load the reset form. Please try again later.',
        tokenValid: false
      });
    }
  }

  static async resetPasswordPost(req: Request, res: Response): Promise<void> {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    const renderReset = (opts: {
      error?: string | null;
      tokenValid: boolean;
    }) => {
      res.render('account/reset-password', {
        pageTitle: 'Reset Password',
        error: opts.error ?? null,
        token,
        tokenValid: opts.tokenValid
      });
    };

    if (!token) {
      renderReset({
        error: 'This reset link is invalid or has expired.',
        tokenValid: false
      });
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      renderReset({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        tokenValid: true
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      renderReset({
        error: 'New password and confirmation do not match.',
        tokenValid: true
      });
      return;
    }

    try {
      const userId = await passwordResetService.consumeValidToken(token);
      if (!userId) {
        renderReset({
          error: 'This reset link is invalid or has expired.',
          tokenValid: false
        });
        return;
      }

      const updated = await usersService.updateUserPassword(userId, newPassword);
      if (!updated) {
        renderReset({
          error: 'Unable to update password. Please try again.',
          tokenValid: false
        });
        return;
      }

      res.redirect(
        '/account/login?success=' +
          encodeURIComponent('Your password has been updated. You can sign in now.')
      );
    } catch (error) {
      console.error('Reset password error:', error);
      renderReset({
        error: 'Unable to reset password. Please try again later.',
        tokenValid: true
      });
    }
  }

  static async requestAccess(req: Request, res: Response): Promise<void> {
    try {
      const apartments = await apartmentsService.getAllApartments();
      (res.locals as any).includeRecaptcha = true;
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: null,
        success: null,
        form: {},
        recaptchaSiteKey: getRecaptchaSiteKey()
      });
    } catch (error) {
      console.error('Error loading request access form:', error);
      (res.locals as any).includeRecaptcha = true;
      res.status(500).render('account/request-access', {
        pageTitle: 'Request Access',
        apartments: [],
        error: 'Unable to load apartments. Please try again later.',
        success: null,
        form: {},
        recaptchaSiteKey: getRecaptchaSiteKey()
      });
    }
  }

  static async requestAccessPost(req: Request, res: Response): Promise<void> {
    (res.locals as any).includeRecaptcha = true;
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const apartmentsRequested = parseAccessRequestApartments(req.body);
    const apartmentIds = apartmentsRequested.map((a) => a.apartmentId);
    const acceptTerms =
      req.body.acceptTerms === '1' ||
      req.body.acceptTerms === 'on' ||
      req.body.acceptTerms === true;

    const apartments = await apartmentsService.getAllApartments();
    const apartmentRoles: Record<number, 'owner' | 'tenant'> = {};
    apartmentsRequested.forEach((a) => {
      apartmentRoles[a.apartmentId] = a.role;
    });
    const form = { fullName, email, phone, apartmentIds, apartmentRoles, acceptTerms };

    if (!fullName || fullName.length < 2) {
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'Please enter your full name.',
        success: null,
        form
      });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'Please enter a valid email address.',
        success: null,
        form
      });
      return;
    }
    if (!phone) {
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'Please enter your phone number.',
        success: null,
        form
      });
      return;
    }
    if (!acceptTerms) {
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'You must accept the Privacy Policy and Terms & Conditions to continue.',
        success: null,
        form
      });
      return;
    }
    if (apartmentIds.length === 0) {
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'Please select at least one apartment.',
        success: null,
        form
      });
      return;
    }

    try {
      if (await accessRequestService.hasPendingEmail(email)) {
        res.render('account/request-access', {
          pageTitle: 'Request Access',
          apartments,
          error: 'An access request with this email is already pending review.',
          success: null,
          form
        });
        return;
      }

      const requestId = await accessRequestService.createRequest({
        fullName,
        email,
        phone,
        apartments: apartmentsRequested
      });

      const selected = apartments.filter((a) => apartmentIds.includes(a.id));
      try {
        await emailService.sendAccessRequest({
          fullName,
          email,
          phone,
          apartmentLabels: selected.map((apt) =>
            apartmentLabelWithRole(apt, apartmentRoles[apt.id] || 'owner')
          ),
          requestId
        });
      } catch (emailError) {
        console.error('Access request saved but notification email failed:', emailError);
      }

      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: null,
        success:
          'Your request has been submitted. You will receive an email once it is reviewed by the administration.',
        form: {}
      });
    } catch (error) {
      console.error('Error submitting access request:', error);
      res.render('account/request-access', {
        pageTitle: 'Request Access',
        apartments,
        error: 'Could not submit your request. Please try again.',
        success: null,
        form
      });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    try {
      const name = String(req.body.name || '').trim();

      if (!name || name.length < 2) {
        res.redirect('/account/profile?error=' + encodeURIComponent('Name must be at least 2 characters.'));
        return;
      }

      // Email and phone are sign-in identifiers and can only be changed by an admin.
      await usersService.updateUser(member.id, { name });
      req.session.member = { ...member, name };
      res.redirect('/account/profile?success=' + encodeURIComponent('Profile updated.'));
    } catch (error) {
      console.error('Error updating profile:', error);
      res.redirect('/account/profile?error=' + encodeURIComponent('Could not update profile.'));
    }
  }

  static async settings(req: Request, res: Response): Promise<void> {
    try {
      const user = await MemberController.loadMemberOrRedirect(req, res);
      if (!user) return;

      res.render(
        'account/settings',
        MemberController.shellLocals('settings', user, {
          pageTitle: 'Account Settings',
          // bcrypt hashes keep the salt inside the hash; the salt column is null for those accounts
          hasPassword: Boolean(user.password),
          success: req.query.success,
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading account settings:', error);
      res.status(500).send('Unable to load account settings');
    }
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const fail = (message: string) =>
      res.redirect('/account/settings?error=' + encodeURIComponent(message));

    try {
      const user = await usersService.getUserById(member.id);
      if (!user) {
        delete req.session.member;
        res.redirect('/account/login');
        return;
      }

      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword || '');
      const confirmPassword = String(req.body.confirmPassword || '');

      // Google-only accounts have no password yet, so there is nothing to verify.
      const hasPassword = Boolean(user.password);

      if (hasPassword) {
        const login = user.email || user.phone || '';
        if (!currentPassword) {
          return void fail('Please enter your current password.');
        }
        const verified = await usersService.authenticateUser(login, currentPassword);
        if (!verified) {
          return void fail('Current password is incorrect.');
        }
      }

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return void fail(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      if (newPassword !== confirmPassword) {
        return void fail('New password and confirmation do not match.');
      }

      if (hasPassword && newPassword === currentPassword) {
        return void fail('New password must be different from your current password.');
      }

      const updated = await usersService.updateUserPassword(member.id, newPassword);
      if (!updated) {
        return void fail('Could not update password. Please try again.');
      }

      res.redirect('/account/settings?success=' + encodeURIComponent('Password updated.'));
    } catch (error) {
      console.error('Error changing password:', error);
      fail('Could not update password. Please try again.');
    }
  }

  static async apartmentDetail(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(apartmentId)) {
      res.redirect('/account/apartments?error=' + encodeURIComponent('Apartment not found.'));
      return;
    }

    try {
      const apartment = await assertMemberApartment(member.id, apartmentId);
      if (!apartment) {
        res.redirect('/account/apartments?error=' + encodeURIComponent('You do not have access to this apartment.'));
        return;
      }

      const [paymentsDue, transactions, walletBalance, walletStatement, pendingListing, pendingGate, pendingImages, pendingTenantRequest, publishedListing, approvedPhotoCount] =
        await Promise.all([
          invoicesService.getUnpaidInvoices({ apartmentId }),
          transactionsService.getFilteredTransactions({ apartmentId }),
          apartmentWalletService.getTotalBalance(apartmentId),
          apartmentWalletService.getWalletStatement(apartmentId),
          memberRequestsService.getPendingListingForApartment(apartmentId),
          memberRequestsService.getPendingGateRequestsForApartment(apartmentId),
          apartmentsService.getMemberPendingImages(apartmentId),
          accessRequestService.getPendingTenantRequestForApartment(apartmentId),
          apartmentListingsService.getByApartmentId(apartmentId),
          apartmentsService.getApprovedPhotoCount(apartmentId)
        ]);

      const user = await usersService.getUserById(member.id);
      if (!user) {
        delete req.session.member;
        res.redirect('/account/login');
        return;
      }

      const parkingMap = await loadParkingMap([apartment]);

      res.render(
        'account/apartment-detail',
        MemberController.shellLocals('apartments', user, {
          pageTitle: `Apartment ${apartmentLabel(apartment)}`,
          apartment,
          apartmentLabel: apartmentLabel(apartment),
          parkingMap,
          paymentsDue: paymentsDue.map((inv) => ({
            ...inv,
            balance: (inv.amount || 0) - (inv.amountPaid || 0)
          })),
          transactions,
          walletBalance,
          walletStatement: walletStatement.entries,
          pendingListing,
          pendingGate,
          pendingImages,
          pendingTenantRequest,
          publishedListing,
          approvedPhotoCount,
          isOwner: true,
          gateRelations: apartmentsService.getGateAccessRelations().filter((r) => r !== 'Owner'),
          photoMaxWidth: APARTMENT_PHOTO_MAX_WIDTH,
          photoMaxFileSize: APARTMENT_PHOTO_MAX_FILE_SIZE,
          photoMaxFileSizeMb: APARTMENT_PHOTO_MAX_FILE_SIZE / (1024 * 1024),
          pageScript: '/js/account-apartment-photos.js',
          includeBootstrap: true,
          success: req.query.success,
          error: req.query.error
        })
      );
    } catch (error) {
      console.error('Error loading apartment detail:', error);
      res.redirect('/account/apartments?error=' + encodeURIComponent('Unable to load apartment.'));
    }
  }

  static async uploadPhoto(req: Request, res: Response): Promise<void> {
    const wantsJson =
      req.xhr || req.headers.accept?.includes('application/json') === true;
    const apartmentId = parseInt(req.params.id, 10);

    const respondError = (status: number, message: string, redirectPath?: string): void => {
      if (wantsJson) {
        res.status(status).json({ success: false, message });
        return;
      }
      res.redirect(redirectPath || `/account/apartments/${apartmentId}?error=` + encodeURIComponent(message));
    };

    const member = getMemberSession(req);
    if (!member) {
      if (wantsJson) {
        res.status(401).json({ success: false, message: 'Please sign in to upload photos.' });
        return;
      }
      res.redirect('/account/login');
      return;
    }

    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      respondError(403, 'You do not own this apartment.', '/account/apartments?error=' + encodeURIComponent('You do not own this apartment.'));
      return;
    }

    const files = ((req as any).files as Express.Multer.File[] | undefined) || [];
    if (!files.length) {
      respondError(400, 'Please choose at least one image.');
      return;
    }

    try {
      const apartmentDir = getApartmentDirPath(apartmentId);
      const uploadedFilenames: string[] = [];

      for (const file of files) {
        const filePath = `${apartmentDir}/${file.filename}`;
        await resizeImageToMaxWidth(filePath);
        await apartmentsService.addPendingImageToApartment(apartmentId, file.filename, member.id);
        uploadedFilenames.push(file.filename);
      }

      await emailService.sendPhotoUploadNotification({
        apartmentLabel: apartmentLabel(apartment),
        uploaderName: member.name,
        uploaderEmail: member.email || undefined,
        uploaderPhone: member.phone || undefined,
        filenames: uploadedFilenames
      });

      const count = uploadedFilenames.length;
      const message = `${count} photo${count === 1 ? '' : 's'} uploaded and pending admin approval.`;

      if (wantsJson) {
        res.json({
          success: true,
          message,
          filenames: uploadedFilenames,
          apartmentId
        });
        return;
      }

      res.redirect(`/account/apartments/${apartmentId}?success=` + encodeURIComponent(message));
    } catch (error) {
      console.error('Error uploading photo:', error);
      respondError(500, 'Could not upload photo.');
    }
  }

  static async deletePhoto(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.status(401).json({ success: false, message: 'Please sign in to remove photos.' });
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    const imageName = path.basename(String(req.body?.filename || ''));
    if (
      !imageName ||
      imageName.includes('..') ||
      imageName.includes('/') ||
      imageName.includes('\\')
    ) {
      res.status(400).json({ success: false, message: 'Invalid image name.' });
      return;
    }

    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      res.status(403).json({ success: false, message: 'You do not own this apartment.' });
      return;
    }

    const pendingImages = await apartmentsService.getMemberPendingImages(apartmentId);
    const isOfficial = apartment.officialImage === imageName;
    const isGallery = (apartment.images || []).includes(imageName);
    const isPending = pendingImages.includes(imageName);

    if (!isOfficial && !isGallery && !isPending) {
      res.status(404).json({ success: false, message: 'Photo not found.' });
      return;
    }

    try {
      const imagePath = path.join(getApartmentDirPath(apartmentId), imageName);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      await apartmentsService.removeImageFromApartment(apartmentId, imageName);

      res.json({ success: true, message: 'Photo removed.' });
    } catch (error) {
      console.error('Error deleting apartment photo:', error);
      res.status(500).json({ success: false, message: 'Could not remove photo.' });
    }
  }

  static async setDefaultPhoto(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.status(401).json({ success: false, message: 'Please sign in to update photos.' });
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    const imageName = path.basename(String(req.body?.filename || ''));
    if (
      !imageName ||
      imageName.includes('..') ||
      imageName.includes('/') ||
      imageName.includes('\\')
    ) {
      res.status(400).json({ success: false, message: 'Invalid image name.' });
      return;
    }

    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      res.status(403).json({ success: false, message: 'You do not have access to this apartment.' });
      return;
    }

    if (apartment.officialImage === imageName) {
      res.json({ success: true, message: 'This photo is already the default.', filename: imageName });
      return;
    }

    const isGallery = (apartment.images || []).includes(imageName);
    if (!isGallery) {
      res.status(400).json({
        success: false,
        message: 'Only approved photos can be set as the default.'
      });
      return;
    }

    const imagePath = path.join(getApartmentDirPath(apartmentId), imageName);
    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ success: false, message: 'Photo not found.' });
      return;
    }

    try {
      const updated = await apartmentsService.setOfficialImage(apartmentId, imageName);
      if (!updated) {
        res.status(500).json({ success: false, message: 'Could not set default photo.' });
        return;
      }

      res.json({
        success: true,
        message: 'Default photo updated.',
        filename: imageName,
        previousFilename: apartment.officialImage || null
      });
    } catch (error) {
      console.error('Error setting default apartment photo:', error);
      res.status(500).json({ success: false, message: 'Could not set default photo.' });
    }
  }

  static async requestListing(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    const form = parseListingFormBody(req.body as Record<string, unknown>);
    const validationError = validateListingForm(form);

    if (validationError) {
      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent(validationError)
      );
      return;
    }

    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      res.redirect('/account/apartments?error=' + encodeURIComponent('You do not have access to this apartment.'));
      return;
    }

    const approvedPhotoCount = await apartmentsService.getApprovedPhotoCount(apartmentId);
    if (approvedPhotoCount < 1) {
      res.redirect(
        `/account/apartments/${apartmentId}?error=` +
          encodeURIComponent('Upload at least one photo and wait for admin approval before submitting your listing.')
      );
      return;
    }

    const isListed = apartment.status === 'for_sale' || apartment.status === 'for_rent';
    const pendingListing = await memberRequestsService.getPendingListingForApartment(apartmentId);
    if (isListed && pendingListing) {
      res.redirect(
        `/account/apartments/${apartmentId}?error=` +
          encodeURIComponent('You already have a pending listing update awaiting approval.')
      );
      return;
    }

    if (!isListed && pendingListing) {
      res.redirect(
        `/account/apartments/${apartmentId}?error=` +
          encodeURIComponent('You already have a pending listing request awaiting approval.')
      );
      return;
    }

    try {
      const requestId = await memberRequestsService.createListingRequest({
        apartmentId,
        userId: member.id,
        requestType: form.requestType,
        description: form.description,
        priceUsd: form.priceUsd,
        priceNegotiable: form.priceNegotiable,
        contactForPrice: form.contactForPrice,
        isFurnished: form.isFurnished,
        parkingSpaces: form.parkingSpaces,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        hasGarden: form.hasGarden,
        hasTerrace: form.hasTerrace,
        hasBalcony: form.hasBalcony,
        hasStorageRoom: form.hasStorageRoom,
        availabilityDate: form.availabilityDate,
        petFriendly: form.petFriendly
      });

      await emailService.sendListingRequest({
        apartmentLabel: apartmentLabel(apartment),
        requestType: form.requestType,
        description: form.description,
        priceUsd: form.priceUsd,
        priceNegotiable: form.priceNegotiable,
        contactForPrice: form.contactForPrice,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        isFurnished: form.isFurnished,
        parkingSpaces: form.parkingSpaces,
        requesterName: member.name,
        requesterEmail: member.email || '',
        requesterPhone: member.phone || undefined,
        ownerName: apartment.ownerName || undefined,
        requestId
      });

      const successMessage = isListed
        ? 'Listing update sent for admin approval.'
        : 'Listing request sent for admin approval. Status will not change until approved.';

      res.redirect(`/account/apartments/${apartmentId}?success=` + encodeURIComponent(successMessage));
    } catch (error) {
      console.error('Error creating listing request:', error);
      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Could not submit listing request.')
      );
    }
  }

  static async removeListing(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      res.redirect('/account/apartments?error=' + encodeURIComponent('You do not have access to this apartment.'));
      return;
    }

    if (apartment.status !== 'for_sale' && apartment.status !== 'for_rent') {
      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent('This apartment is not currently listed.')
      );
      return;
    }

    try {
      const nextStatus = apartment.renterId ? 'rented' : 'owned';
      await apartmentsService.updateApartment(apartmentId, { status: nextStatus as any });
      await apartmentListingsService.deleteByApartmentId(apartmentId);
      await memberRequestsService.cancelPendingListingRequests(apartmentId);

      res.redirect(
        `/account/apartments/${apartmentId}?success=` +
          encodeURIComponent('Listing removed. The apartment is no longer shown for sale or rent.')
      );
    } catch (error) {
      console.error('Error removing listing:', error);
      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Could not remove listing.')
      );
    }
  }

  static async manageTenant(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const apartmentId = parseInt(req.params.id, 10);
    const action = String(req.body.action || '').toLowerCase();
    const apartment = await assertMemberApartment(member.id, apartmentId);

    if (!apartment) {
      res.redirect('/account/apartments?error=' + encodeURIComponent('You do not have access to this apartment.'));
      return;
    }

    try {
      if (action === 'remove') {
        if (!apartment.renterId) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` + encodeURIComponent('No tenant to remove.')
          );
          return;
        }

        const previousRenterId = apartment.renterId;
        const updates: Record<string, unknown> = { renterId: null };
        if (apartment.status === 'rented') {
          updates.status = 'owned';
        }

        const updated = await apartmentsService.updateApartment(apartmentId, updates as any);
        if (!updated) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Could not remove tenant.')
          );
          return;
        }

        await apartmentsService.removeGateAccessUser(apartmentId, previousRenterId);

        res.redirect(
          `/account/apartments/${apartmentId}?success=` + encodeURIComponent('Tenant removed.')
        );
        return;
      }

      if (action === 'add') {
        if (apartment.renterId) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` +
              encodeURIComponent('Remove the current tenant before adding a new one.')
          );
          return;
        }

        const existingPending = await accessRequestService.getPendingTenantRequestForApartment(apartmentId);
        if (existingPending) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` +
              encodeURIComponent('A tenant access request is already pending admin approval.')
          );
          return;
        }

        const fullName = String(req.body.fullName || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = String(req.body.phone || '').trim();

        if (!fullName || fullName.length < 2) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Tenant name is required.')
          );
          return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` + encodeURIComponent('A valid tenant email is required.')
          );
          return;
        }

        if (await accessRequestService.hasPendingEmail(email)) {
          res.redirect(
            `/account/apartments/${apartmentId}?error=` +
              encodeURIComponent('An access request with this email is already pending review.')
          );
          return;
        }

        const requestId = await accessRequestService.createRequest({
          fullName,
          email,
          phone: phone || '—',
          apartments: [{ apartmentId, role: 'tenant' }]
        });

        try {
          await emailService.sendAccessRequest({
            fullName,
            email,
            phone: phone || '—',
            apartmentLabels: [`${apartmentLabel(apartment)} (Tenant)`],
            requestId,
            requestedBy: member.name,
            note: 'An owner requested tenant portal access for their apartment.'
          });
        } catch (emailError) {
          console.error('Tenant access request saved but notification email failed:', emailError);
        }

        res.redirect(
          `/account/apartments/${apartmentId}?success=` +
            encodeURIComponent(
              'Tenant access request submitted. An administrator will review it and grant portal access.'
            )
        );
        return;
      }

      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Invalid tenant action.')
      );
    } catch (error) {
      console.error('Error managing tenant:', error);
      res.redirect(
        `/account/apartments/${apartmentId}?error=` + encodeURIComponent('Could not update tenant.')
      );
    }
  }

  static async requestGateAccess(req: Request, res: Response): Promise<void> {
    const member = getMemberSession(req);
    if (!member) {
      res.redirect('/account/login');
      return;
    }

    const returnToGateAccess = String(req.body.returnTo || '') === 'gate-access';
    const fromRequestPage = String(req.originalUrl || '').includes('/gate-access/request');
    const apartmentId = parseInt(String(req.params.id || req.body.apartmentId || ''), 10);
    const action = String(req.body.action || '') as 'add' | 'remove';

    const redirectWith = (key: 'success' | 'error', message: string): void => {
      if (fromRequestPage && key === 'error') {
        const params = new URLSearchParams();
        params.set('error', message);
        if (!Number.isNaN(apartmentId)) {
          params.set('apartmentId', String(apartmentId));
        }
        res.redirect(`/account/gate-access/request?${params.toString()}`);
        return;
      }
      const redirectBase = returnToGateAccess || fromRequestPage
        ? '/account/gate-access'
        : Number.isNaN(apartmentId)
          ? '/account/apartments'
          : `/account/apartments/${apartmentId}`;
      res.redirect(`${redirectBase}?${key}=` + encodeURIComponent(message));
    };

    if (Number.isNaN(apartmentId)) {
      redirectWith('error', returnToGateAccess || fromRequestPage ? 'Select an apartment.' : 'Apartment not found.');
      return;
    }

    const apartment = await assertMemberApartment(member.id, apartmentId);
    if (!apartment) {
      if (returnToGateAccess || fromRequestPage) {
        redirectWith('error', 'You do not have access to this apartment.');
      } else {
        res.redirect('/account/apartments?error=' + encodeURIComponent('You do not have access to this apartment.'));
      }
      return;
    }

    if (action !== 'add' && action !== 'remove') {
      redirectWith('error', 'Invalid gate access action.');
      return;
    }

    try {
      let targetUserId: number | null = null;
      let targetName: string | null = null;
      let targetPhone: string | null = null;
      let targetEmail: string | null = null;
      let relation: string | null = null;
      let expiryDate: string | null = null;

      if (action === 'remove') {
        targetUserId = parseInt(String(req.body.targetUserId || ''), 10);
        if (Number.isNaN(targetUserId)) {
          redirectWith('error', 'Select a person to remove.');
          return;
        }
        const gateUsers = apartment.gateAccessUsers || [];
        const target = gateUsers.find((u: any) => u.id === targetUserId);
        targetName = target?.name || 'Unknown';
        relation = target?.relation || null;
      } else {
        targetName = String(req.body.targetName || '').trim();
        targetPhone = String(req.body.targetPhone || '').trim();
        targetEmail = String(req.body.targetEmail || '').trim() || null;
        relation = String(req.body.relation || 'Guest').trim();
        expiryDate = String(req.body.expiryDate || '').trim() || null;
        if (!targetName) {
          redirectWith('error', 'Full name is required.');
          return;
        }
        if (!targetPhone) {
          redirectWith('error', 'Phone is required.');
          return;
        }
      }

      const requestId = await memberRequestsService.createGateAccessRequest({
        apartmentId,
        userId: member.id,
        action,
        targetUserId,
        targetName,
        targetPhone,
        targetEmail,
        relation,
        expiryDate
      });

      const owner = await usersService.getUserById(member.id);
      const notice = {
        apartmentLabel: apartmentLabel(apartment),
        ownerName: owner?.name || member.name,
        ownerEmail: owner?.email || member.email || null,
        ownerPhone: owner?.phone || member.phone || null,
        targetName: targetName || '',
        targetPhone: targetPhone || '',
        targetEmail,
        relation,
        expiryDate,
        requestId
      };

      if (action === 'add') {
        let granted: { ok: boolean; loginPhone: string; errorMessage?: string; cloudWarning?: string };
        try {
          granted = await memberRequestsService.acceptNewGateAccessRequest({
            requestId,
            apartmentId,
            targetName: targetName || '',
            targetPhone: targetPhone || '',
            targetEmail,
            relation,
            expiryDate
          });
        } catch (grantError) {
          console.error('Error granting website gate access:', grantError);
          try {
            await emailService.sendGateAccessGrantFailed({
              ...notice,
              errorMessage: grantError instanceof Error ? grantError.message : String(grantError),
              errorStack: grantError instanceof Error ? grantError.stack : undefined
            });
          } catch (emailError) {
            console.error('Could not email admin about gate access failure:', emailError);
          }
          redirectWith('error', 'Gate access could not be completed. The office has been notified.');
          return;
        }

        if (!granted.ok) {
          try {
            await emailService.sendGateAccessGrantFailed({
              ...notice,
              loginPhone: granted.loginPhone,
              errorMessage: granted.errorMessage || 'Gate access could not be completed.'
            });
          } catch (emailError) {
            console.error('Could not email admin about gate access failure:', emailError);
          }
          redirectWith('error', 'Gate access could not be completed. The office has been notified.');
          return;
        }

        const recipients = gateAccessRecipientEmails(notice.ownerEmail, targetEmail);
        if (recipients.length === 0) {
          try {
            await emailService.sendGateAccessGrantFailed({
              ...notice,
              loginPhone: granted.loginPhone,
              errorMessage: 'Gate access was granted, but nobody had an email address for the app instructions.'
            });
          } catch (emailError) {
            console.error('Could not email admin about missing gate access recipient:', emailError);
          }
          redirectWith(
            'error',
            'Gate access is active, but no email address was available for the app instructions. The office has been notified.'
          );
          return;
        }

        try {
          await emailService.sendGateAccessGranted({
            ...notice,
            to: recipients,
            loginPhone: granted.loginPhone
          });
        } catch (emailError) {
          console.error('Gate access granted but instruction email failed:', emailError);
          try {
            await emailService.sendGateAccessGrantFailed({
              ...notice,
              loginPhone: granted.loginPhone,
              errorMessage: emailError instanceof Error
                ? `Instruction email failed: ${emailError.message}`
                : 'Instruction email failed.',
              errorStack: emailError instanceof Error ? emailError.stack : undefined
            });
          } catch (adminEmailError) {
            console.error('Could not email admin about gate access email failure:', adminEmailError);
          }
          redirectWith(
            'error',
            'Gate access is active, but the instruction email could not be sent. The office has been notified.'
          );
          return;
        }

        try {
          if (granted.cloudWarning) {
            await emailService.sendGateAccessGrantFailed({
              ...notice,
              loginPhone: granted.loginPhone,
              errorMessage: `The existing SafeMate account was left unchanged and the instruction email was still sent. ${granted.cloudWarning}`
            });
          } else {
            await emailService.sendGateAccessGrantedNotice({
              ...notice,
              loginPhone: granted.loginPhone
            });
          }
        } catch (emailError) {
          console.error('Gate access granted but admin notification failed:', emailError);
        }

        redirectWith(
          'success',
          'Gate access is active. Check your email for the Safemate app download links and password.'
        );
        return;
      }

      try {
        await emailService.sendGateAccessRequest({
          apartmentLabel: apartmentLabel(apartment),
          action,
          targetName: targetName || '',
          relation: relation || '',
          ownerName: member.name,
          requestId
        });
      } catch (emailError) {
        console.error('Gate access request saved but notification email failed:', emailError);
      }

      redirectWith('success', 'Gate access removal request sent for admin approval.');
    } catch (error) {
      console.error('Error creating gate access request:', error);
      if (action === 'add') {
        try {
          await emailService.sendGateAccessGrantFailed({
            apartmentLabel: apartmentLabel(apartment),
            ownerName: member.name,
            ownerEmail: member.email || null,
            ownerPhone: member.phone || null,
            targetName: String(req.body.targetName || ''),
            targetPhone: String(req.body.targetPhone || ''),
            targetEmail: String(req.body.targetEmail || '').trim() || null,
            relation: String(req.body.relation || '') || null,
            expiryDate: String(req.body.expiryDate || '').trim() || null,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          });
        } catch (emailError) {
          console.error('Could not email admin about gate access failure:', emailError);
        }
        redirectWith('error', 'Gate access could not be completed. The office has been notified.');
        return;
      }
      redirectWith('error', 'Could not submit gate access request.');
    }
  }
}
