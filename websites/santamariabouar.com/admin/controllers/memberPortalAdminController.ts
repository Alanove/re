import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { accessRequestService } from '../../src/services/accessRequestService';
import { accessApprovalService, AccessApprovalError } from '../../src/services/accessApprovalService';
import { memberRequestsService } from '../../src/services/memberRequestsService';
import { emailService } from '../../src/services/emailService';
import { usersService } from '../services/usersService';
import { apartmentsService, ApartmentLinkAction } from '../services/apartmentsService';
import { apartmentListingsService } from '../../src/services/apartmentListingsService';
import { safegateService } from '../../src/services/safegateService';
import { getApartmentDirPath } from '../../src/constants';

function getAdminUserId(req: Request): number {
  return (req.session as any)?.user?.id || 0;
}

function sortApartmentsByBlockAndNumber<T extends { block: string; unitNumberOfficial: string }>(
  apartments: T[]
): T[] {
  return [...apartments].sort((a, b) => {
    const blockA = a.block || '';
    const blockB = b.block || '';
    if (blockA < blockB) return -1;
    if (blockA > blockB) return 1;

    const numA = a.unitNumberOfficial || '';
    const numB = b.unitNumberOfficial || '';
    const nA = parseInt(numA, 10);
    const nB = parseInt(numB, 10);
    if (!Number.isNaN(nA) && !Number.isNaN(nB) && nA !== nB) {
      return nA - nB;
    }

    return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export class MemberPortalAdminController {
  // ---------- Access Requests ----------
  static async accessRequests(req: Request, res: Response): Promise<void> {
    try {
      const requests = await accessRequestService.getAllRequests();
      res.render('member-portal/access-requests', {
        requests,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error listing access requests:', error);
      res.render('member-portal/access-requests', {
        requests: [],
        error: 'Failed to load access requests'
      });
    }
  }

  static async accessRequestDetail(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const request = await accessRequestService.getRequestById(id);
      if (!request) {
        res.redirect('/admin/access-requests?error=' + encodeURIComponent('Request not found'));
        return;
      }

      const members = (await usersService.getAllUsers())
        .filter((u) => u.role === 'Member')
        .sort((a, b) => {
          const nameA = (a.name || '').trim();
          const nameB = (b.name || '').trim();
          const byName = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          if (byName !== 0) return byName;
          return (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' });
        });
      const allApartments = sortApartmentsByBlockAndNumber(await apartmentsService.getAllApartments());

      // Suggest current owners only for owner-role apartment requests (never for tenants)
      const suggestedOwnerIds = [
        ...new Set(
          request.apartments
            .filter((a) => a.role !== 'tenant')
            .map((a) => a.ownerId)
            .filter((id): id is number => Boolean(id))
        )
      ];
      const suggestedMemberIds = [...suggestedOwnerIds];
      const hasTenantRequest = request.apartments.some((a) => a.role === 'tenant');
      const hasOwnerRequest = request.apartments.some((a) => a.role !== 'tenant');

      const formValues = {
        fullName: String(req.query.fullName || request.fullName),
        email: String(req.query.email || request.email),
        phone: String(req.query.phone || request.phone)
      };

      res.render('member-portal/access-request-review', {
        request,
        members,
        allApartments,
        suggestedOwnerIds,
        suggestedMemberIds,
        hasTenantRequest,
        hasOwnerRequest,
        formValues,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error loading access request:', error);
      res.redirect('/admin/access-requests?error=' + encodeURIComponent('Failed to load request'));
    }
  }

  static async approveAccessRequest(req: Request, res: Response): Promise<void> {
    const requestId = parseInt(req.params.id, 10);
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();

    const redirectApproveError = (message: string) => {
      const params = new URLSearchParams();
      params.set('error', message);
      if (fullName) params.set('fullName', fullName);
      if (email) params.set('email', email);
      if (phone) params.set('phone', phone);
      res.redirect(`/admin/access-requests/${requestId}?${params.toString()}`);
    };

    let apartmentIds: number[] = [];
    const raw = req.body.apartmentIds;
    if (Array.isArray(raw)) {
      apartmentIds = raw.map((v: string) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n));
    } else if (raw) {
      apartmentIds = [parseInt(String(raw), 10)].filter((n) => !Number.isNaN(n));
    }

    try {
      const adminId = getAdminUserId(req);
      const result = await accessApprovalService.approve({
        requestId,
        linkMode: String(req.body.linkMode || 'existing') === 'create' ? 'create' : 'existing',
        userId: parseInt(String(req.body.userId || ''), 10),
        fullName,
        email,
        phone,
        apartmentIds,
        apartmentRoles: (req.body.apartmentRoles || {}) as Record<string, string>,
        apartmentActions: (req.body.apartmentActions || {}) as Record<string, string>,
        adminId: adminId || null
      });

      res.redirect('/admin/access-requests?success=' + encodeURIComponent(result.message));
    } catch (error) {
      if (error instanceof AccessApprovalError) {
        if (error.notFound) {
          res.redirect('/admin/access-requests?error=' + encodeURIComponent(error.message));
          return;
        }
        redirectApproveError(error.message);
        return;
      }
      console.error('Error approving access request:', error);
      const message =
        error instanceof Error && /already exists/i.test(error.message)
          ? error.message
          : 'Approval failed. Please try again.';
      redirectApproveError(message);
    }
  }

  static async rejectAccessRequest(req: Request, res: Response): Promise<void> {
    const requestId = parseInt(req.params.id, 10);
    try {
      await accessApprovalService.reject(requestId);
      res.redirect(
        '/admin/access-requests?success=' + encodeURIComponent('Request rejected and removed.')
      );
    } catch (error) {
      if (error instanceof AccessApprovalError && error.notFound) {
        res.redirect('/admin/access-requests?error=' + encodeURIComponent(error.message));
        return;
      }
      console.error('Error rejecting access request:', error);
      res.redirect('/admin/access-requests?error=' + encodeURIComponent('Reject failed'));
    }
  }

  // ---------- Listing Requests ----------
  static async listingRequests(req: Request, res: Response): Promise<void> {
    try {
      const status = String(req.query.status || 'pending');
      const requests = await memberRequestsService.getListingRequests(
        status === 'all' ? undefined : status
      );
      res.render('member-portal/listing-requests', {
        requests,
        status,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error listing listing requests:', error);
      res.render('member-portal/listing-requests', {
        requests: [],
        status: 'pending',
        error: 'Failed to load listing requests'
      });
    }
  }

  static async approveListingRequest(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const request = await memberRequestsService.getListingRequestById(id);
      if (!request || request.status !== 'pending') {
        res.redirect('/admin/listing-requests?error=' + encodeURIComponent('Request not found'));
        return;
      }

      const approvedPhotoCount = await apartmentsService.getApprovedPhotoCount(request.apartmentId);
      if (approvedPhotoCount < 1) {
        res.redirect(
          '/admin/listing-requests?error=' +
            encodeURIComponent('Cannot approve: apartment has no approved photos.')
        );
        return;
      }

      await apartmentListingsService.upsertFromRequest(
        {
          apartmentId: request.apartmentId,
          listingType: request.requestType,
          description: (request.description || '').trim() || null,
          priceUsd: request.priceUsd,
          priceNegotiable: request.priceNegotiable,
          contactForPrice: request.contactForPrice,
          isFurnished: request.isFurnished,
          parkingSpaces: request.parkingSpaces,
          bedrooms: request.bedrooms,
          bathrooms: request.bathrooms,
          hasGarden: request.hasGarden,
          hasTerrace: request.hasTerrace,
          hasBalcony: request.hasBalcony,
          hasStorageRoom: request.hasStorageRoom,
          availabilityDate: request.availabilityDate,
          petFriendly: request.petFriendly
        },
        getAdminUserId(req)
      );

      await apartmentsService.updateApartment(
        request.apartmentId,
        {
          status: request.requestType,
          listingDescription: (request.description || '').trim() || null
        },
        getAdminUserId(req) ? { changedBy: getAdminUserId(req) } : undefined
      );

      await memberRequestsService.reviewListingRequest(id, 'approved', getAdminUserId(req));
      res.redirect(
        '/admin/listing-requests?success=' + encodeURIComponent('Listing approved and apartment status updated.')
      );
    } catch (error) {
      console.error('Error approving listing request:', error);
      res.redirect('/admin/listing-requests?error=' + encodeURIComponent('Approval failed'));
    }
  }

  static async rejectListingRequest(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      await memberRequestsService.reviewListingRequest(id, 'rejected', getAdminUserId(req));
      res.redirect('/admin/listing-requests?success=' + encodeURIComponent('Listing request rejected.'));
    } catch (error) {
      console.error('Error rejecting listing request:', error);
      res.redirect('/admin/listing-requests?error=' + encodeURIComponent('Reject failed'));
    }
  }

  // ---------- Gate Access Requests ----------
  static async gateAccessRequests(req: Request, res: Response): Promise<void> {
    try {
      const status = String(req.query.status || 'pending');
      const requests = await memberRequestsService.getGateAccessRequests(
        status === 'all' ? undefined : status
      );
      res.render('member-portal/gate-access-requests', {
        requests,
        status,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error listing gate access requests:', error);
      res.render('member-portal/gate-access-requests', {
        requests: [],
        status: 'pending',
        error: 'Failed to load gate access requests'
      });
    }
  }

  static async approveGateAccessRequest(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const request = await memberRequestsService.getGateAccessRequestById(id);
      if (!request || request.status !== 'pending') {
        res.redirect('/admin/gate-access-requests?error=' + encodeURIComponent('Request not found'));
        return;
      }

      let targetUserId: number | null = request.targetUserId || null;
      if (request.action === 'remove') {
        if (!targetUserId) {
          res.redirect(
            '/admin/gate-access-requests?error=' + encodeURIComponent('Missing target user for removal')
          );
          return;
        }
        await apartmentsService.removeGateAccessUser(request.apartmentId, targetUserId);
      } else {
        if (!targetUserId) {
          // Prefer an existing Member matched by phone (digits-only), then email
          if (request.targetPhone) {
            const byPhone = await usersService.getUserByPhone(request.targetPhone);
            if (byPhone) {
              targetUserId = byPhone.id;
            }
          }
          if (!targetUserId && request.targetEmail) {
            const byEmail = await usersService.getUserByEmail(request.targetEmail);
            if (byEmail) {
              targetUserId = byEmail.id;
            }
          }
        }
        if (!targetUserId) {
          // Create a lightweight Member for gate access
          const baseName = (request.targetName || 'Gate Access User').trim();
          if (request.targetPhone) {
            try {
              await usersService.assertPhoneAvailable(request.targetPhone);
            } catch {
              res.redirect(
                '/admin/gate-access-requests?error=' +
                  encodeURIComponent('A user with this phone number already exists')
              );
              return;
            }
          }
          if (request.targetEmail) {
            try {
              await usersService.assertEmailAvailable(request.targetEmail);
            } catch {
              res.redirect(
                '/admin/gate-access-requests?error=' +
                  encodeURIComponent('A user with this email already exists')
              );
              return;
            }
          }
          const created = await usersService.createUser({
            name: baseName,
            ...(request.targetPhone ? { phone: request.targetPhone } : {}),
            ...(request.targetEmail ? { email: request.targetEmail } : {}),
            status: 'Active',
            role: 'Member'
          });
          targetUserId = created.id;
        }
        await apartmentsService.upsertGateAccessUser(
          request.apartmentId,
          targetUserId,
          request.relation || 'Guest',
          request.expiryDate || null
        );
      }

      await memberRequestsService.reviewGateAccessRequest(id, 'approved', getAdminUserId(req));

      let successMessage = 'Gate access change applied.';
      try {
        if (targetUserId) {
          const cloudUser = await usersService.getUserById(targetUserId);
          if (cloudUser) {
            const cloud = request.action === 'remove'
              ? await safegateService.syncRevokeAfterGateRemoval(cloudUser)
              : await safegateService.syncGrantForUser(cloudUser, request.expiryDate || null);
            if (cloud.message) {
              successMessage += ` ${cloud.message}`;
            }
          }
        }
      } catch (cloudError) {
        console.error('Gate access saved but SafeMate sync failed:', cloudError);
        successMessage += ' SafeMate is unreachable. The database change was kept.';
      }
      try {
        const owner = await usersService.getUserById(request.userId);
        if (owner?.email) {
          await emailService.sendGateAccessApproved({
            to: owner.email,
            ownerName: owner.name || request.ownerName || 'Owner',
            apartmentLabel: request.apartmentLabel || `Apartment #${request.apartmentId}`,
            action: request.action,
            targetName: request.targetName || 'the requested person',
            relation: request.relation,
            expiryDate: request.expiryDate
          });
        } else {
          successMessage += ' The owner has no email on file so no notification was sent.';
        }
      } catch (emailError) {
        console.error('Gate access approved but notification email failed:', emailError);
        successMessage += ' The approval notification email could not be sent.';
      }

      res.redirect(
        '/admin/gate-access-requests?success=' + encodeURIComponent(successMessage)
      );
    } catch (error) {
      console.error('Error approving gate access request:', error);
      res.redirect('/admin/gate-access-requests?error=' + encodeURIComponent('Approval failed'));
    }
  }

  static async rejectGateAccessRequest(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const request = await memberRequestsService.getGateAccessRequestById(id);
      if (!request || request.status !== 'pending') {
        res.redirect('/admin/gate-access-requests?error=' + encodeURIComponent('Request not found'));
        return;
      }

      await memberRequestsService.reviewGateAccessRequest(id, 'rejected', getAdminUserId(req));

      let successMessage = 'Gate access request rejected.';
      try {
        const owner = await usersService.getUserById(request.userId);
        if (owner?.email) {
          await emailService.sendGateAccessRejected({
            to: owner.email,
            ownerName: owner.name || request.ownerName || 'Owner',
            apartmentLabel: request.apartmentLabel || `Apartment #${request.apartmentId}`,
            action: request.action,
            targetName: request.targetName || 'the requested person'
          });
        } else {
          successMessage =
            'Gate access request rejected, but the owner has no email on file so no notification was sent.';
        }
      } catch (emailError) {
        console.error('Gate access rejected but notification email failed:', emailError);
        successMessage =
          'Gate access request rejected, but the notification email could not be sent.';
      }

      res.redirect(
        '/admin/gate-access-requests?success=' + encodeURIComponent(successMessage)
      );
    } catch (error) {
      console.error('Error rejecting gate access request:', error);
      res.redirect('/admin/gate-access-requests?error=' + encodeURIComponent('Reject failed'));
    }
  }

  // ---------- Photo Approvals ----------
  static async photoApprovals(req: Request, res: Response): Promise<void> {
    try {
      const pending = await apartmentsService.getPendingImages();
      res.render('member-portal/photo-approvals', {
        images: pending,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error listing pending photos:', error);
      res.render('member-portal/photo-approvals', {
        images: [],
        error: 'Failed to load pending photos'
      });
    }
  }

  static async approvePhoto(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const ok = await apartmentsService.approvePendingImage(id);
      if (!ok) {
        res.redirect('/admin/photo-approvals?error=' + encodeURIComponent('Photo not found'));
        return;
      }
      res.redirect('/admin/photo-approvals?success=' + encodeURIComponent('Photo approved.'));
    } catch (error) {
      console.error('Error approving photo:', error);
      res.redirect('/admin/photo-approvals?error=' + encodeURIComponent('Approval failed'));
    }
  }

  static async rejectPhoto(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const removed = await apartmentsService.rejectPendingImage(id);
      if (!removed) {
        res.redirect('/admin/photo-approvals?error=' + encodeURIComponent('Photo not found'));
        return;
      }

      try {
        const filePath = path.join(getApartmentDirPath(removed.apartmentId), removed.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fsError) {
        console.error('Failed to delete rejected photo file:', fsError);
      }

      res.redirect('/admin/photo-approvals?success=' + encodeURIComponent('Photo rejected and removed.'));
    } catch (error) {
      console.error('Error rejecting photo:', error);
      res.redirect('/admin/photo-approvals?error=' + encodeURIComponent('Reject failed'));
    }
  }
}
