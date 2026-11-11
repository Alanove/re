import { Request, Response } from 'express';
import { ApartmentsService } from '../services/apartmentsService';
import { User, UsersService } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { phoneKeys, safegateService } from '../../src/services/safegateService';

const apartmentsService = ApartmentsService.getInstance();
const usersService = new UsersService();
const siteSettingsService = SiteSettingsService.getInstance();

function redirectWithMessage(
  res: Response,
  query: Record<string, string | undefined>,
  key: 'success' | 'error',
  message: string
): void {
  const params = new URLSearchParams();
  if (query.block) params.set('block', query.block);
  if (query.unitNumber) params.set('unitNumber', query.unitNumber);
  if (query.relation) params.set('relation', query.relation);
  if (query.search) params.set('search', query.search);
  params.set(key, message);
  res.redirect(`/admin/main-gate-access?${params.toString()}`);
}

function apartmentChoiceLabel(apartment: {
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial?: string;
  ownerName?: string;
}): string {
  const code = [apartment.block, apartment.unitNumberOfficial].filter(Boolean).join(' ');
  const unofficial =
    apartment.unitNumberUnofficial && apartment.unitNumberUnofficial !== apartment.unitNumberOfficial
      ? ` (${apartment.unitNumberUnofficial})`
      : '';
  const owner = String(apartment.ownerName || '').trim();
  return owner ? `${code}${unofficial} — ${owner}` : `${code}${unofficial}`;
}

function usersSharingPhone(phone: string, cmsUsers: User[]): User[] {
  const wanted = new Set(phoneKeys(phone));
  if (wanted.size === 0) {
    return [];
  }
  return cmsUsers.filter((user) => phoneKeys(user.phone).some((key) => wanted.has(key)));
}

async function resolveGateAccessPerson(input: {
  userId: number;
  name: string;
  phone: string;
  email: string;
}): Promise<{ user: User; phone: string; email: string; name: string; savedWithoutEmail: boolean }> {
  if (input.userId > 0) {
    const existing = await usersService.getUserById(input.userId);
    if (!existing) {
      throw new Error('Invalid user selected');
    }
    const phone = input.phone || String(existing.phone || '').trim();
    if (!phone) {
      throw new Error('A phone number is required so this person can be added to the SafeMate app');
    }
    if (input.phone && !String(existing.phone || '').trim()) {
      const updated = await usersService.updateUser(existing.id, { phone: input.phone });
      return {
        user: updated || existing,
        phone,
        email: input.email || String(existing.email || '').trim(),
        name: input.name || existing.name,
        savedWithoutEmail: false
      };
    }
    return {
      user: existing,
      phone,
      email: input.email || String(existing.email || '').trim(),
      name: input.name || existing.name,
      savedWithoutEmail: false
    };
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (!name) {
    throw new Error('Name is required');
  }
  if (!phone) {
    throw new Error('A phone number is required so this person can be added to the SafeMate app');
  }

  const cmsUsers = await usersService.getAllUsers();
  const phoneMatches = usersSharingPhone(phone, cmsUsers);
  if (phoneMatches.length > 1) {
    throw new Error(`Several users share this phone: ${phoneMatches.map((user) => user.name).join(', ')}`);
  }
  if (phoneMatches.length === 1) {
    const match = phoneMatches[0];
    return {
      user: match,
      phone,
      email: email || String(match.email || '').trim(),
      name: match.name,
      savedWithoutEmail: false
    };
  }

  let emailForCms: string | undefined;
  let savedWithoutEmail = false;
  if (email) {
    const emailOwner = await usersService.getUserByEmail(email);
    if (emailOwner) {
      savedWithoutEmail = true;
    } else {
      emailForCms = email;
    }
  }

  try {
    const created = await usersService.createUser({
      name,
      phone,
      ...(emailForCms ? { email: emailForCms } : {}),
      status: 'Active',
      role: 'Member'
    });
    return { user: created, phone, email: email || '', name, savedWithoutEmail };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    if (!emailForCms || !/email already exists/i.test(detail)) {
      throw error;
    }
    const created = await usersService.createUser({
      name,
      phone,
      status: 'Active',
      role: 'Member'
    });
    return { user: created, phone, email, name, savedWithoutEmail: true };
  }
}

function sortApartmentsByBlockAndNumber<T extends { block: string; unitNumberOfficial: string }>(
  apartments: T[]
): T[] {
  return [...apartments].sort((a, b) => {
    const blockCmp = String(a.block || '').localeCompare(String(b.block || ''), undefined, {
      sensitivity: 'base'
    });
    if (blockCmp !== 0) return blockCmp;
    return String(a.unitNumberOfficial || '').localeCompare(String(b.unitNumberOfficial || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

export class MainGateAccessController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const relationParam = String(req.query.relation || '').trim();
      const allowedRelations = apartmentsService.getGateAccessRelations();
      const relationFilter =
        relationParam && allowedRelations.includes(relationParam as any) ? relationParam : '';

      const availableBlocks = apartmentsService.getAvailableBlocks();
      const blockParam = String(req.query.block || '').trim().toUpperCase();
      const blockFilter = availableBlocks.includes(blockParam) ? blockParam : '';
      const unitNumberFilter = String(req.query.unitNumber || '').trim();

      const filters = {
        block: blockFilter,
        unitNumber: unitNumberFilter,
        relation: relationFilter,
        search: (req.query.search as string) || ''
      };

      const [rows, apartments, users, siteTitle] = await Promise.all([
        apartmentsService.getMainGateAccessReport({
          block: filters.block || undefined,
          unitNumber: filters.unitNumber || undefined,
          relation: filters.relation || undefined,
          search: filters.search || undefined
        }),
        apartmentsService.getAllApartments(),
        usersService.getAllUsers(),
        siteSettingsService.getSiteTitle()
      ]);

      const sortedApartments = sortApartmentsByBlockAndNumber(apartments);
      const sortedUsers = [...users].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      const gateAccessChoices = {
        apartments: sortedApartments.map((apartment) => ({
          id: apartment.id,
          block: apartment.block,
          unit: apartment.unitNumberOfficial,
          unofficial: apartment.unitNumberUnofficial || '',
          owner: apartment.ownerName || '',
          label: apartmentChoiceLabel(apartment)
        })),
        users: sortedUsers.map((person) => ({
          id: person.id,
          name: person.name,
          email: person.email || '',
          phone: person.phone || ''
        }))
      };

      res.render('main-gate-access/index', {
        title: 'Main Gate Access',
        pageTitle: 'Main Gate Access',
        pageSubtitle: 'Manage who can enter the compound through the main gate',
        siteTitle,
        user: (req.session as any).user,
        rows,
        apartments: sortedApartments,
        users: sortedUsers,
        gateAccessChoices,
        availableBlocks,
        gateAccessRelations: apartmentsService.getGateAccessRelations(),
        filters,
        totalEntries: rows.length,
        success: req.query.success,
        error: req.query.error,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error loading main gate access:', error);
      res.status(500).render('admin/error', {
        message: 'Error loading main gate access',
        error
      });
    }
  }

  static async addPost(req: Request, res: Response): Promise<void> {
    const query = {
      block: String(req.body.returnBlock || ''),
      unitNumber: String(req.body.returnUnitNumber || ''),
      relation: String(req.body.returnRelation || ''),
      search: String(req.body.returnSearch || '')
    };

    try {
      const apartmentId = parseInt(String(req.body.apartmentId), 10);
      const userId = parseInt(String(req.body.userId), 10);
      const relation = String(req.body.relation || 'Other').trim();
      const expiryDate = String(req.body.expiryDate || '').trim() || null;
      const name = String(req.body.name || '').trim();
      const phone = String(req.body.phone || '').trim();
      const email = String(req.body.email || '').trim();

      if (!Number.isFinite(apartmentId) || apartmentId <= 0) {
        return redirectWithMessage(res, query, 'error', 'Please select an apartment');
      }

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return redirectWithMessage(res, query, 'error', 'Apartment not found');
      }

      const allowedRelations = apartmentsService.getGateAccessRelations();
      if (!allowedRelations.includes(relation as any)) {
        return redirectWithMessage(res, query, 'error', 'Invalid relation selected');
      }

      const person = await resolveGateAccessPerson({
        userId: Number.isFinite(userId) ? userId : 0,
        name,
        phone,
        email
      });

      const added = await apartmentsService.upsertGateAccessUser(
        apartmentId,
        person.user.id,
        relation,
        expiryDate
      );
      if (!added) {
        return redirectWithMessage(res, query, 'error', 'Failed to add gate access');
      }

      const cloud = await safegateService.grantAccess({
        phone: person.phone,
        email: person.email,
        name: person.name,
        expiryDate
      });
      let message = `Gate access saved for ${person.user.name}.`;
      if (person.savedWithoutEmail) {
        message += ' The CMS user was saved without an email because that address is already used.';
      }
      if (cloud.message) {
        message += ` ${cloud.message}`;
      }
      if (!cloud.ok) {
        return redirectWithMessage(res, query, 'error', message);
      }
      redirectWithMessage(res, query, 'success', message);
    } catch (error) {
      console.error('Error adding gate access:', error);
      const detail = error instanceof Error ? error.message : '';
      redirectWithMessage(res, query, 'error', detail || 'Failed to add gate access');
    }
  }

  static async editPost(req: Request, res: Response): Promise<void> {
    const query = {
      block: String(req.body.returnBlock || ''),
      unitNumber: String(req.body.returnUnitNumber || ''),
      relation: String(req.body.returnRelation || ''),
      search: String(req.body.returnSearch || '')
    };

    try {
      const apartmentId = parseInt(req.params.apartmentId, 10);
      const userId = parseInt(req.params.userId, 10);
      const relation = String(req.body.relation || 'Other').trim();
      const expiryDate = String(req.body.expiryDate || '').trim() || null;

      if (!Number.isFinite(apartmentId) || apartmentId <= 0 || !Number.isFinite(userId) || userId <= 0) {
        return redirectWithMessage(res, query, 'error', 'Invalid gate access entry');
      }

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return redirectWithMessage(res, query, 'error', 'Apartment not found');
      }

      const allowedRelations = apartmentsService.getGateAccessRelations();
      if (!allowedRelations.includes(relation as any)) {
        return redirectWithMessage(res, query, 'error', 'Invalid relation selected');
      }

      const updated = await apartmentsService.upsertGateAccessUser(
        apartmentId,
        userId,
        relation,
        expiryDate
      );
      if (!updated) {
        return redirectWithMessage(res, query, 'error', 'Failed to update gate access');
      }

      redirectWithMessage(res, query, 'success', 'Gate access updated successfully');
    } catch (error) {
      console.error('Error updating gate access:', error);
      redirectWithMessage(res, query, 'error', 'Failed to update gate access');
    }
  }

  static async revokePost(req: Request, res: Response): Promise<void> {
    const query = {
      block: String(req.body.returnBlock || ''),
      unitNumber: String(req.body.returnUnitNumber || ''),
      relation: String(req.body.returnRelation || ''),
      search: String(req.body.returnSearch || '')
    };

    try {
      const apartmentId = parseInt(req.params.apartmentId, 10);
      const userId = parseInt(req.params.userId, 10);

      if (!Number.isFinite(apartmentId) || apartmentId <= 0 || !Number.isFinite(userId) || userId <= 0) {
        return redirectWithMessage(res, query, 'error', 'Invalid gate access entry');
      }

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return redirectWithMessage(res, query, 'error', 'Apartment not found');
      }

      const user = await usersService.getUserById(userId);
      const removed = await apartmentsService.removeGateAccessUser(apartmentId, userId);
      if (!removed) {
        return redirectWithMessage(res, query, 'error', 'Gate access entry not found');
      }

      let message = 'Gate access revoked successfully';
      if (user) {
        const cloud = await safegateService.syncRevokeAfterGateRemoval(user);
        if (cloud.message) {
          message += `. ${cloud.message}`;
        }
      }
      redirectWithMessage(res, query, 'success', message);
    } catch (error) {
      console.error('Error revoking gate access:', error);
      redirectWithMessage(res, query, 'error', 'Failed to revoke gate access');
    }
  }
}
