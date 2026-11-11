import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { apartmentsService, UserApartmentRelation } from '../services/apartmentsService';
import { usersService, User } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import {
  isProtectedSafemateAccount,
  phoneKeys,
  SafemateSubUser,
  safegateService
} from '../../src/services/safegateService';

const siteSettingsService = SiteSettingsService.getInstance();

interface MatchedUser {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  keepReason: string | null;
  apartments: UserApartmentRelation[];
}

interface SafemateRow {
  account: string;
  phone: string;
  email: string;
  validDate: string;
  protected: boolean;
  status: 'system' | 'matched' | 'app-only';
  matches: MatchedUser[];
}

interface SafemateFilters {
  status: '' | 'app-only' | 'matched' | 'system';
  q: string;
}

const STATUS_LABELS: Record<SafemateRow['status'], string> = {
  'app-only': 'App only',
  matched: 'Matched',
  system: 'System'
};

function redirectToPage(
  res: Response,
  key: 'success' | 'error',
  message: string,
  search?: string
): void {
  const params = new URLSearchParams();
  if (search) {
    params.set('q', search);
  }
  params.set(key, message);
  res.redirect(`/admin/main-gate/safemate?${params.toString()}`);
}

function wantsJson(req: Request): boolean {
  return req.xhr === true || req.headers.accept?.includes('application/json') === true;
}

function displayPhone(user: SafemateSubUser): string {
  return user.phone || user.account;
}

function keepReasonFor(user: User, guards: Map<number, 'owner' | 'history'>): string | null {
  const guard = guards.get(user.id);
  if (guard === 'owner') {
    return 'owns an apartment';
  }
  if (guard === 'history') {
    return 'appears in owner history';
  }
  if (user.role !== 'Member') {
    return 'is a staff account';
  }
  return null;
}

function safematePhoneKeys(sub: Pick<SafemateSubUser, 'phone' | 'account'>): string[] {
  const fromPhone = phoneKeys(sub.phone);
  return fromPhone.length ? fromPhone : phoneKeys(sub.account);
}

function usersSharingKeys(wanted: string[], cmsUsers: User[]): User[] {
  if (wanted.length === 0) {
    return [];
  }
  const keys = new Set(wanted);
  return cmsUsers.filter((user) => phoneKeys(user.phone).some((key) => keys.has(key)));
}

function usersMatching(sub: SafemateSubUser, cmsUsers: User[]): User[] {
  return usersSharingKeys(safematePhoneKeys(sub), cmsUsers);
}

function readFilters(query: Request['query']): SafemateFilters {
  const status = String(query.status || '').trim();
  return {
    status: status === 'app-only' || status === 'matched' || status === 'system' ? status : '',
    q: String(query.q || '').trim()
  };
}

function rowMatchesFilters(row: SafemateRow, filters: SafemateFilters): boolean {
  if (filters.status && row.status !== filters.status) {
    return false;
  }

  const query = filters.q.trim();
  if (!query) {
    return true;
  }

  const needle = query.toLowerCase();
  const names = row.matches.flatMap((match) => [
    match.name,
    ...match.apartments.map((apartment) => apartment.mainOwner)
  ]).join(' ').toLowerCase();
  if (names.includes(needle)) {
    return true;
  }

  const phones = [row.phone, row.account, ...row.matches.map((match) => match.phone)].join(' ');
  if (phones.toLowerCase().includes(needle)) {
    return true;
  }

  const digits = query.replace(/\D/g, '');
  if (digits && phones.replace(/\D/g, '').includes(digits)) {
    return true;
  }

  return false;
}

function filterQueryString(filters: SafemateFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  return params.toString();
}

async function loadSafemateRows(): Promise<{ ok: boolean; message: string; rows: SafemateRow[] }> {
  const [listed, cmsUsers] = await Promise.all([
    safegateService.listSubUsers(),
    usersService.getAllUsers()
  ]);

  const matchedIds = listed.users.flatMap((sub) => usersMatching(sub, cmsUsers).map((user) => user.id));
  const [guards, apartmentsByUser] = await Promise.all([
    apartmentsService.getGateUserDeletionGuards(matchedIds),
    apartmentsService.getApartmentRelationsByUserIds(matchedIds)
  ]);

  const rows: SafemateRow[] = listed.users.map((sub) => {
    const matches = usersMatching(sub, cmsUsers).map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      role: user.role,
      keepReason: keepReasonFor(user, guards),
      apartments: apartmentsByUser.get(user.id) || []
    }));
    const status: SafemateRow['status'] = sub.protected
      ? 'system'
      : matches.length > 0
        ? 'matched'
        : 'app-only';
    return {
      account: sub.account,
      phone: displayPhone(sub),
      email: sub.email,
      validDate: sub.validDate,
      protected: sub.protected,
      status,
      matches
    };
  });

  return {
    ok: listed.ok,
    message: listed.ok ? '' : (listed.message || 'SafeMate is unreachable.'),
    rows
  };
}

function apartmentLabel(apartment: {
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial?: string;
  ownerName?: string;
}): string {
  const code = [apartment.block, apartment.unitNumberOfficial].filter(Boolean).join(' ');
  const unofficial = apartment.unitNumberUnofficial && apartment.unitNumberUnofficial !== apartment.unitNumberOfficial
    ? ` (${apartment.unitNumberUnofficial})`
    : '';
  const owner = apartment.ownerName ? ` — ${apartment.ownerName}` : '';
  return `${code}${unofficial}${owner}`.trim();
}

export class SafemateUsersController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const filters = readFilters(req.query);
      const [loaded, apartments, siteTitle] = await Promise.all([
        loadSafemateRows(),
        apartmentsService.getAllApartments(),
        siteSettingsService.getSiteTitle()
      ]);
      const rows = loaded.rows.filter((row) => rowMatchesFilters(row, filters));

      const apartmentOptions = [...apartments]
        .sort((a, b) => {
          const blockCmp = String(a.block || '').localeCompare(String(b.block || ''), undefined, { sensitivity: 'base' });
          if (blockCmp !== 0) return blockCmp;
          return String(a.unitNumberOfficial || '').localeCompare(String(b.unitNumberOfficial || ''), undefined, {
            numeric: true,
            sensitivity: 'base'
          });
        })
        .map((apartment) => ({ id: apartment.id, label: apartmentLabel(apartment) }));

      res.render('main-gate/safemate', {
        title: 'SafeMate Users',
        pageTitle: 'SafeMate Users',
        pageSubtitle: 'App accounts compared with CMS users by the last 6 phone digits',
        siteTitle,
        user: (req.session as any).user,
        rows,
        totalCount: loaded.rows.length,
        filters,
        exportQuery: filterQueryString(filters),
        apartmentOptions,
        relations: apartmentsService.getGateAccessRelations(),
        cloudOk: loaded.ok,
        cloudMessage: loaded.message,
        success: req.query.success,
        error: req.query.error,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error loading SafeMate users:', error);
      res.status(500).render('admin/error', {
        message: 'Error loading SafeMate users',
        error
      });
    }
  }

  static async exportNumbers(req: Request, res: Response): Promise<void> {
    try {
      const filters = readFilters(req.query);
      const loaded = await loadSafemateRows();
      if (!loaded.ok) {
        return redirectToPage(res, 'error', loaded.message || 'SafeMate is unreachable.');
      }

      const rows = loaded.rows.filter((row) => rowMatchesFilters(row, filters));
      const sheetRows = rows.map((row) => ({
        Phone: { t: 's', v: row.phone || '' },
        'SafeMate account': { t: 's', v: row.account || '' },
        Status: STATUS_LABELS[row.status],
        'CMS names': row.matches.map((match) => match.name).filter(Boolean).join(', '),
        'CMS phones': { t: 's', v: row.matches.map((match) => match.phone).filter(Boolean).join(', ') },
        'Related to apartment': row.matches.some((match) => match.apartments.length) ? 'Yes' : 'No',
        Apartments: row.matches.flatMap((match) => match.apartments.map((apartment) => {
          const owner = apartment.mainOwner ? `, main owner ${apartment.mainOwner}` : '';
          return `${apartment.label} (${apartment.relation}${owner})`;
        })).join('; ')
      }));
      const worksheet = XLSX.utils.json_to_sheet(
        sheetRows.length
          ? sheetRows
          : [{
            Phone: '',
            'SafeMate account': '',
            Status: '',
            'CMS names': '',
            'CMS phones': '',
            'Related to apartment': '',
            Apartments: ''
          }]
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Numbers');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="safemate-numbers.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting SafeMate numbers:', error);
      redirectToPage(res, 'error', 'Failed to export numbers');
    }
  }

  static async addPost(req: Request, res: Response): Promise<void> {
    try {
      const name = String(req.body.name || '').trim();
      const phone = String(req.body.phone || '').trim();
      const email = String(req.body.email || '').trim();
      const relation = String(req.body.relation || 'Guest').trim();
      const existingAccount = String(req.body.account || '').trim();
      const apartmentId = parseInt(String(req.body.apartmentId), 10);

      if (!name) {
        return redirectToPage(res, 'error', 'Name is required');
      }
      if (!phone) {
        return redirectToPage(res, 'error', 'Phone is required');
      }
      if (!Number.isFinite(apartmentId) || apartmentId <= 0) {
        return redirectToPage(res, 'error', 'Please select an apartment');
      }
      if (isProtectedSafemateAccount(existingAccount)) {
        return redirectToPage(res, 'error', 'This SafeMate account is protected');
      }

      const allowedRelations = apartmentsService.getGateAccessRelations();
      if (!allowedRelations.includes(relation as any)) {
        return redirectToPage(res, 'error', 'Invalid relation selected');
      }

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return redirectToPage(res, 'error', 'Apartment not found');
      }

      const cmsUsers = await usersService.getAllUsers();
      const phoneMatches = usersSharingKeys(phoneKeys(phone), cmsUsers);
      let cmsUser: User;
      let savedWithoutEmail = false;

      if (phoneMatches.length > 1) {
        const names = phoneMatches.map((user) => user.name).join(', ');
        return redirectToPage(res, 'error', `Several CMS users share this phone: ${names}.`, phone);
      }

      if (phoneMatches.length === 1) {
        cmsUser = phoneMatches[0];
      } else {
        let emailForCms: string | undefined;
        if (email) {
          const emailOwner = await usersService.getUserByEmail(email);
          if (emailOwner) {
            savedWithoutEmail = true;
          } else {
            emailForCms = email;
          }
        }
        try {
          cmsUser = await usersService.createUser({
            name,
            phone,
            ...(emailForCms ? { email: emailForCms } : {}),
            status: 'Active',
            role: 'Member'
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : '';
          if (!emailForCms || !/email already exists/i.test(detail)) {
            throw error;
          }
          savedWithoutEmail = true;
          cmsUser = await usersService.createUser({
            name,
            phone,
            status: 'Active',
            role: 'Member'
          });
        }
      }

      const added = await apartmentsService.upsertGateAccessUser(
        apartmentId,
        cmsUser.id,
        relation,
        null
      );
      if (!added) {
        return redirectToPage(res, 'error', 'The user was saved, but gate access could not be added', phone);
      }

      const cloud = await safegateService.grantAccess({
        phone,
        email: email || cmsUser.email,
        name,
        existingAccount: existingAccount || null
      });
      let message = `Access saved for ${cmsUser.name}.`;
      if (savedWithoutEmail) {
        message += ' The CMS user was saved without an email because that address is already used. SafeMate still has the original email.';
      }
      if (cloud.message) {
        message += ` ${cloud.message}`;
      }
      redirectToPage(res, 'success', message, phone);
    } catch (error) {
      console.error('Error adding SafeMate access:', error);
      const detail = error instanceof Error ? error.message : 'Failed to add access';
      redirectToPage(res, 'error', detail);
    }
  }

  static async revokePost(req: Request, res: Response): Promise<void> {
    const reply = (ok: boolean, message: string): void => {
      if (wantsJson(req)) {
        res.status(ok ? 200 : 400).json({ success: ok, message });
        return;
      }
      redirectToPage(res, ok ? 'success' : 'error', message);
    };

    try {
      const account = String(req.body.account || '').trim();
      const phone = String(req.body.phone || '').trim();
      if (!account) {
        return reply(false, 'Missing SafeMate account');
      }
      if (isProtectedSafemateAccount(account)) {
        return reply(false, `SafeMate account ${account} is protected and was not removed`);
      }

      const cmsUsers = await usersService.getAllUsers();
      const fromPhone = phoneKeys(phone);
      const matches = usersSharingKeys(fromPhone.length ? fromPhone : phoneKeys(account), cmsUsers);
      const guards = await apartmentsService.getGateUserDeletionGuards(matches.map((user) => user.id));

      const deleted: string[] = [];
      const kept: string[] = [];
      for (const user of matches) {
        const reason = keepReasonFor(user, guards);
        if (reason) {
          await apartmentsService.removeAllGateAccessForUser(user.id);
          kept.push(`${user.name} (${reason})`);
          continue;
        }
        const removed = await usersService.deleteUser(user.id);
        if (removed) {
          deleted.push(user.name);
        } else {
          await apartmentsService.removeAllGateAccessForUser(user.id);
          kept.push(`${user.name} (database refused delete)`);
        }
      }

      const cloud = await safegateService.revokeAccount(account);
      const parts = [cloud.message || `SafeMate account ${account} was processed.`];
      if (deleted.length) {
        parts.push(`Deleted CMS users: ${deleted.join(', ')}.`);
      }
      if (kept.length) {
        parts.push(`Kept CMS users and removed their gate access: ${kept.join(', ')}.`);
      }
      if (!matches.length) {
        parts.push('No CMS user matched this phone.');
      }
      reply(cloud.ok, parts.join(' '));
    } catch (error) {
      console.error('Error revoking SafeMate access:', error);
      reply(false, 'Failed to revoke access');
    }
  }
}
