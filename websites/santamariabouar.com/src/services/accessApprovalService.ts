import { usersService } from '../../admin/services/usersService';
import { apartmentsService, ApartmentLinkAction } from '../../admin/services/apartmentsService';
import { accessRequestService, AccessRequest } from './accessRequestService';
import { emailService } from './emailService';

export class AccessApprovalError extends Error {
  constructor(message: string, public readonly notFound = false) {
    super(message);
    this.name = 'AccessApprovalError';
  }
}

export interface ApproveAccessInput {
  requestId: number;
  linkMode: 'create' | 'existing';
  userId?: number | null;
  fullName: string;
  email: string;
  phone: string;
  apartmentIds: number[];
  /** apartmentId -> 'owner' | 'tenant'; falls back to the role on the request */
  apartmentRoles?: Record<string, string>;
  /** apartmentId -> 'transfer_primary' to replace the current primary owner */
  apartmentActions?: Record<string, string>;
  adminId?: number | null;
}

export interface ApproveAccessResult {
  userId: number;
  linkMode: 'create' | 'existing';
  email: string;
  tempPassword: string;
  emailSent: boolean;
  message: string;
}

export function resolveApartmentRole(
  request: Pick<AccessRequest, 'apartments'>,
  apartmentId: number,
  apartmentRoles: Record<string, string> = {}
): 'owner' | 'tenant' {
  const fromForm = String(apartmentRoles[String(apartmentId)] || '').toLowerCase();
  if (fromForm === 'tenant' || fromForm === 'owner') return fromForm;
  const fromRequest = request.apartments.find((a) => a.id === apartmentId);
  return fromRequest?.role === 'tenant' ? 'tenant' : 'owner';
}

export function resolveLinkAction(
  role: 'owner' | 'tenant',
  hasPrimaryOwner: boolean,
  requestedAction?: string
): ApartmentLinkAction {
  if (role === 'tenant') return 'add_tenant';
  if (!hasPrimaryOwner) return 'set_primary';
  if (String(requestedAction || '').toLowerCase() === 'transfer_primary') return 'transfer_primary';
  return 'add_owner';
}

export class AccessApprovalService {
  /**
   * Validates everything up front, then creates/updates the member, links the
   * apartments, deletes the request, and emails a temporary password.
   */
  public async approve(input: ApproveAccessInput): Promise<ApproveAccessResult> {
    const fullName = String(input.fullName || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const phone = String(input.phone || '').trim();
    const apartmentIds = [...new Set((input.apartmentIds || []).filter((n) => Number.isFinite(n) && n > 0))];

    const request = await accessRequestService.getRequestById(input.requestId);
    if (!request) throw new AccessApprovalError('Request not found', true);

    if (!fullName || !email || !phone) throw new AccessApprovalError('Name, email, and phone are required');
    if (!email.includes('@')) throw new AccessApprovalError('Please provide a valid email address');
    if (apartmentIds.length === 0) throw new AccessApprovalError('Select at least one apartment to link');

    const allApartments = await apartmentsService.getAllApartments();
    const aptById = new Map(allApartments.map((a) => [a.id, a]));
    if (apartmentIds.some((id) => !aptById.has(id))) {
      throw new AccessApprovalError('One of the selected apartments no longer exists');
    }

    const plan = apartmentIds.map((apartmentId) => {
      const role = resolveApartmentRole(request, apartmentId, input.apartmentRoles);
      return {
        apartmentId,
        role,
        action: resolveLinkAction(
          role,
          Boolean(aptById.get(apartmentId)?.ownerId),
          input.apartmentActions?.[String(apartmentId)]
        )
      };
    });

    const linkMode = input.linkMode === 'create' ? 'create' : 'existing';
    let existingUserId: number | null = null;

    if (linkMode === 'create') {
      await this.assertAvailable(
        () => usersService.assertEmailAvailable(email),
        'A user with this email already exists. Change the email, or link to that member instead.'
      );
      await this.assertAvailable(
        () => usersService.assertPhoneAvailable(phone),
        'A user with this phone number already exists. Change the phone, or link to that member instead.'
      );
    } else {
      const userId = Number(input.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new AccessApprovalError('Select an existing member user to link, or create a new member');
      }
      const existingUser = await usersService.getUserById(userId);
      if (!existingUser || existingUser.role !== 'Member') {
        throw new AccessApprovalError('Selected user must be a Member');
      }
      await this.assertAvailable(
        () => usersService.assertEmailAvailable(email, userId),
        'This email is already used by another user. Change it and try again.'
      );
      await this.assertAvailable(
        () => usersService.assertPhoneAvailable(phone, userId),
        'This phone number is already used by another user. Change it and try again.'
      );

      const linkingAnyAsTenant = plan.some((p) => p.role === 'tenant');
      const isPrimaryOfSelected = apartmentIds.some((id) => aptById.get(id)?.ownerId === userId);
      if (linkingAnyAsTenant && isPrimaryOfSelected) {
        throw new AccessApprovalError(
          'Cannot link a tenant request to the apartment’s current primary owner — that would overwrite the owner’s contact details. Create a new member instead.'
        );
      }
      existingUserId = userId;
    }

    const tempPassword = usersService.generateTempPassword();
    let userId: number;
    if (existingUserId === null) {
      const created = await usersService.createUser({
        name: fullName,
        email,
        phone,
        password: tempPassword,
        status: 'Active',
        role: 'Member',
        walletEnabled: false
      });
      userId = created.id;
    } else {
      userId = existingUserId;
      await usersService.updateUser(userId, { name: fullName, email, phone, status: 'Active', role: 'Member' });
      await usersService.updateUserPassword(userId, tempPassword);
    }

    const changedBy = input.adminId ? { changedBy: input.adminId } : undefined;
    for (const step of plan) {
      await apartmentsService.linkMemberOnApprove(step.apartmentId, userId, step.action, changedBy);
    }

    await accessRequestService.deleteRequest(input.requestId);

    let emailSent = true;
    let message =
      linkMode === 'create'
        ? 'Access approved. New member created and emailed with temporary password.'
        : 'Access approved. Member emailed with temporary password.';
    try {
      await emailService.sendAccessApproved({ to: email, fullName, tempPassword });
    } catch (emailError) {
      console.error('Access approved but email failed:', emailError);
      emailSent = false;
      message =
        `Access approved, but the email could not be sent (${email}). ` +
        `Share this temporary password with the member manually: ${tempPassword}`;
    }

    return { userId, linkMode, email, tempPassword, emailSent, message };
  }

  public async reject(requestId: number): Promise<void> {
    const request = await accessRequestService.getRequestById(requestId);
    if (!request) throw new AccessApprovalError('Request not found', true);

    try {
      await emailService.sendAccessRejected({ to: request.email, fullName: request.fullName });
    } catch (mailError) {
      console.error('Failed to send rejection email:', mailError);
    }

    await accessRequestService.deleteRequest(requestId);
  }

  private async assertAvailable(check: () => Promise<void>, message: string): Promise<void> {
    try {
      await check();
    } catch {
      throw new AccessApprovalError(message);
    }
  }
}

export const accessApprovalService = new AccessApprovalService();
