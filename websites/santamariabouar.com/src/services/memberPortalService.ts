import { apartmentsService } from '../../admin/services/apartmentsService';
import { InvoicesService } from '../../admin/services/invoicesService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { PaymentsService } from '../../admin/services/paymentsService';

const invoicesService = InvoicesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const paymentsService = PaymentsService.getInstance();

export function apartmentLabel(apt: {
  block?: string;
  unitNumberOfficial?: string;
  unitNumberUnofficial?: string;
}): string {
  return `Block ${apt.block || ''} ${apt.unitNumberOfficial || ''} (${apt.unitNumberUnofficial || ''})`.trim();
}

export async function assertMemberApartment(memberId: number, apartmentId: number) {
  const apartment = await apartmentsService.getApartmentById(apartmentId);
  if (!apartment) return null;
  const link = await apartmentsService.getMemberApartmentLink(apartmentId, memberId);
  if (link) return apartment;
  // Fallback for pre-migration edge cases
  if (apartment.ownerId === memberId || apartment.renterId === memberId) {
    return apartment;
  }
  return null;
}

export async function getMemberApartments(memberId: number) {
  const linked = await apartmentsService.getApartmentsForMember(memberId);
  if (linked.length > 0) {
    return linked;
  }
  // Fallback if apartment_users empty for this user
  const [owned, rented] = await Promise.all([
    apartmentsService.getApartmentsByOwner(memberId),
    apartmentsService.getApartmentsByRenter(memberId)
  ]);
  const ownedWithRole = owned.map((apt) => ({
    ...apt,
    memberRole: 'owner' as const,
    isPrimaryOwner: true
  }));
  const rentedIds = new Set(rented.map((apt) => apt.id));
  return [
    ...ownedWithRole.filter((apt) => !rentedIds.has(apt.id)),
    ...rented.map((apt) => ({ ...apt, isPrimaryOwner: false }))
  ];
}

export async function loadPaymentsDueForMember(memberId: number) {
  const apartments = await getMemberApartments(memberId);
  const paymentsDue: any[] = [];

  for (const apt of apartments) {
    const unpaid = await invoicesService.getUnpaidInvoices({ apartmentId: apt.id });
    unpaid.forEach((inv) => {
      paymentsDue.push({
        ...inv,
        apartmentLabel: apartmentLabel(apt),
        balance: (inv.amount || 0) - (inv.amountPaid || 0)
      });
    });
  }

  return paymentsDue;
}

export async function loadPaymentInstructionLocals() {
  const [settings, yearlyInterestRate] = await Promise.all([
    siteSettingsService.getAllSettings(),
    paymentsService.getYearlyInterestRate()
  ]);
  return {
    janitorName: settings.janitorName || '',
    janitorPhone: settings.janitorPhone || '',
    paymentSettings: settings.payments,
    yearlyInterestRate
  };
}
