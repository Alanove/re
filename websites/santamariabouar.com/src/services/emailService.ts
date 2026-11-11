import { sendMail } from '../config/mailer';
import { SAFEMATE_APP_PASSWORD } from './safegateService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { ApartmentsService } from '../../admin/services/apartmentsService';
import { UsersService } from '../../admin/services/usersService';
import { InvoicesService } from '../../admin/services/invoicesService';
import { TransactionCategoriesService } from '../../admin/services/transactionCategoriesService';
import { InvoiceTransactionsService } from '../../admin/services/invoiceTransactionsService';
import { ApartmentWalletService } from '../../admin/services/apartmentWalletService';

const siteSettingsService = SiteSettingsService.getInstance();
const apartmentsService = ApartmentsService.getInstance();
const invoicesService = InvoicesService.getInstance();
const categoriesService = TransactionCategoriesService.getInstance();
const usersService = new UsersService();

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
}

async function getAdminEmail(): Promise<string> {
  const email = await siteSettingsService.getContactEmail();
  if (email) return email;
  return process.env.ADMIN_NOTIFY_EMAIL || 'admin@santamariabouar.com';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function apartmentLabel(apt: {
  block?: string;
  unitNumberOfficial?: string;
  unitNumberUnofficial?: string;
}): string {
  return `Block ${apt.block || ''} ${apt.unitNumberOfficial || ''} (${apt.unitNumberUnofficial || ''})`.trim();
}

const SAFEMATE_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.yaoertai.safemate&hl=en_NZ';
const SAFEMATE_IPHONE_URL = 'https://apps.apple.com/lb/app/safemate2/id1317683104';

export interface GateAccessNotice {
  apartmentLabel: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  targetName: string;
  targetPhone: string;
  targetEmail?: string | null;
  relation?: string | null;
  expiryDate?: string | null;
  requestId?: number | null;
  loginPhone?: string | null;
}

function gateAccessDetailLines(data: GateAccessNotice): string[] {
  return [
    `Apartment: ${data.apartmentLabel}`,
    `Person: ${data.targetName}`,
    `Phone: ${data.targetPhone || '—'}`,
    `App login phone: ${data.loginPhone || '—'}`,
    `Email: ${data.targetEmail || '—'}`,
    `Relation: ${data.relation || '—'}`,
    data.expiryDate ? `Expires: ${data.expiryDate}` : 'Expires: no expiry',
    `Requested by: ${data.ownerName}`,
    `Requester email: ${data.ownerEmail || '—'}`,
    `Requester phone: ${data.ownerPhone || '—'}`,
    data.requestId ? `Request #${data.requestId}` : null
  ].filter((line): line is string => line !== null);
}

function safemateInstructionLines(loginPhone: string): string[] {
  return [
    'Download the Safemate app:',
    `Android: ${SAFEMATE_ANDROID_URL}`,
    `iPhone: ${SAFEMATE_IPHONE_URL}`,
    '',
    'Log in with this phone number (do not include the country code) and password:',
    `Phone: ${loginPhone}`,
    `Password: ${SAFEMATE_APP_PASSWORD}`
  ];
}

function addUniqueEmail(emails: string[], seen: Set<string>, raw?: string | null): void {
  const email = (raw || '').trim();
  if (!email) {
    return;
  }
  const key = email.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  emails.push(email);
}

/**
 * Unique emails for money receipts: primary owner + all tenants.
 */
async function getApartmentPaymentRecipients(apartmentId: number): Promise<string[]> {
  const apartment = await apartmentsService.getApartmentById(apartmentId);
  if (!apartment) {
    return [];
  }

  const seen = new Set<string>();
  const emails: string[] = [];

  let ownerEmail = (apartment.ownerEmail || '').trim();
  if (apartment.ownerId) {
    const owner = await usersService.getUserById(apartment.ownerId);
    if (owner?.email) {
      ownerEmail = owner.email.trim();
    }
  }
  addUniqueEmail(emails, seen, ownerEmail);

  const members = await apartmentsService.listApartmentUsers(apartmentId);
  for (const member of members) {
    if (member.role === 'tenant') {
      addUniqueEmail(emails, seen, member.email);
    }
  }
  addUniqueEmail(emails, seen, apartment.renterEmail);

  return emails;
}

async function getBrandedLogoUrl(): Promise<string> {
  const settings = await siteSettingsService.getAllSettings();
  const logoPath = settings.logo || '/images/logo.jpg';
  return logoPath.startsWith('http')
    ? logoPath
    : `${getBaseUrl()}${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
}

function wrapBrandedEmailHtml(logoUrl: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 12px;text-align:center;border-bottom:1px solid #eee;">
              <img src="${escapeHtml(logoUrl)}" alt="Santa Maria Bouar" style="max-height:64px;max-width:220px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;font-size:12px;color:#888;text-align:center;border-top:1px solid #eee;">
              Santa Maria Bouar
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export class EmailService {
  public async sendAccessRequest(data: {
    fullName: string;
    email: string;
    phone: string;
    apartmentLabels: string[];
    requestId: number;
    requestedBy?: string;
    note?: string;
  }): Promise<void> {
    const to = await getAdminEmail();
    const reviewUrl = `${getBaseUrl()}/admin/access-requests/${data.requestId}`;
    const apartments = data.apartmentLabels.length
      ? data.apartmentLabels.join(', ')
      : 'None selected';

    await sendMail({
      to,
      subject: `New My Account access request — ${data.fullName}`,
      text: [
        data.note || 'A new access request was submitted for the My Account portal.',
        '',
        `Name: ${data.fullName}`,
        `Email: ${data.email}`,
        `Phone: ${data.phone || '—'}`,
        `Apartments: ${apartments}`,
        data.requestedBy ? `Requested by owner: ${data.requestedBy}` : null,
        '',
        `Review: ${reviewUrl}`
      ].filter((line) => line !== null).join('\n')
    });
  }

  public async sendAccessApproved(data: {
    to: string;
    fullName: string;
    tempPassword: string;
  }): Promise<void> {
    const loginUrl = `${getBaseUrl()}/account/login`;
    await sendMail({
      to: data.to,
      subject: 'Your Santa Maria Bouar account is ready',
      text: [
        `Hello ${data.fullName},`,
        '',
        'Your My Account access has been approved.',
        '',
        `Login page: ${loginUrl}`,
        `Email: ${data.to}`,
        `Temporary password: ${data.tempPassword}`,
        '',
        'You can also sign in with Google using the same email address.',
        'Please change your password after logging in if you use password login.',
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendAccessRejected(data: {
    to: string;
    fullName: string;
  }): Promise<void> {
    await sendMail({
      to: data.to,
      subject: 'My Account access request update',
      text: [
        `Hello ${data.fullName},`,
        '',
        'Unfortunately your My Account access request could not be approved at this time.',
        'Please contact the administration office if you believe this is an error.',
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendPasswordReset(data: {
    to: string;
    fullName: string;
    resetUrl: string;
  }): Promise<void> {
    await sendMail({
      to: data.to,
      subject: 'Reset your Santa Maria Bouar password',
      text: [
        `Hello ${data.fullName},`,
        '',
        'We received a request to reset your My Account password.',
        '',
        'Use this one-time link to choose a new password (expires in 1 hour):',
        data.resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendListingRequest(data: {
    apartmentLabel: string;
    requestType: string;
    description?: string;
    priceUsd?: number | null;
    priceNegotiable?: boolean;
    contactForPrice?: boolean;
    bedrooms?: number;
    bathrooms?: number;
    isFurnished?: boolean;
    parkingSpaces?: number;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    ownerName?: string;
    requestId: number;
  }): Promise<void> {
    const to = await getAdminEmail();
    const reviewUrl = `${getBaseUrl()}/admin/listing-requests`;
    const priceLine = data.contactForPrice
      ? 'Price: Contact for price'
      : data.priceUsd != null
        ? `Price: $${data.priceUsd.toLocaleString('en-US')}${data.priceNegotiable ? ' (negotiable)' : ''}`
        : 'Price: —';

    await sendMail({
      to,
      subject: `Listing request: ${data.apartmentLabel} → ${data.requestType}`,
      text: [
        'A listing request was submitted for an apartment.',
        '',
        `Apartment: ${data.apartmentLabel}`,
        `Request type: ${data.requestType}`,
        `Requested by: ${data.requesterName}`,
        `Email: ${data.requesterEmail}`,
        data.requesterPhone ? `Phone: ${data.requesterPhone}` : null,
        data.ownerName ? `Apartment owner: ${data.ownerName}` : null,
        '',
        priceLine,
        `Bedrooms: ${data.bedrooms ?? '—'}`,
        `Bathrooms: ${data.bathrooms ?? '—'}`,
        `Furnished: ${data.isFurnished ? 'Yes' : 'No'}`,
        `Parking spaces: ${data.parkingSpaces ?? 0}`,
        '',
        'Description:',
        data.description || '(none)',
        '',
        `Review: ${reviewUrl}`
      ].filter((line) => line !== null).join('\n')
    });
  }

  public async sendGateAccessRequest(data: {
    apartmentLabel: string;
    action: string;
    targetName: string;
    relation: string;
    ownerName: string;
    requestId: number;
  }): Promise<void> {
    const to = await getAdminEmail();
    const reviewUrl = `${getBaseUrl()}/admin/gate-access-requests`;
    await sendMail({
      to,
      subject: `Gate access ${data.action} request — ${data.apartmentLabel}`,
      text: [
        'An owner requested a main gate access change.',
        '',
        `Apartment: ${data.apartmentLabel}`,
        `Action: ${data.action}`,
        `Person: ${data.targetName}`,
        `Relation: ${data.relation}`,
        `Requested by: ${data.ownerName}`,
        '',
        `Review: ${reviewUrl}`
      ].join('\n')
    });
  }

  public async sendGateAccessGranted(data: GateAccessNotice & { to: string | string[] }): Promise<void> {
    const loginPhone = data.loginPhone || data.targetPhone;
    await sendMail({
      to: data.to,
      subject: `Main gate access — ${data.apartmentLabel}`,
      text: [
        'Hello,',
        '',
        `Main gate access for ${data.targetName} at ${data.apartmentLabel} is active.`,
        '',
        `Apartment: ${data.apartmentLabel}`,
        `Person: ${data.targetName}`,
        data.relation ? `Relation: ${data.relation}` : null,
        data.expiryDate ? `Expires: ${data.expiryDate}` : 'Expires: no expiry',
        '',
        ...safemateInstructionLines(loginPhone),
        '',
        '— Santa Maria Bouar'
      ].filter((line) => line !== null).join('\n')
    });
  }

  public async sendGateAccessGrantedNotice(data: GateAccessNotice): Promise<void> {
    const to = await getAdminEmail();
    const reportUrl = `${getBaseUrl()}/admin/main-gate-access`;
    await sendMail({
      to,
      subject: `Gate access granted — ${data.apartmentLabel}`,
      text: [
        'Main gate access was granted immediately from the website.',
        '',
        ...gateAccessDetailLines(data),
        '',
        `Record: ${reportUrl}`,
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendGateAccessGrantFailed(
    data: GateAccessNotice & { errorMessage: string; errorStack?: string }
  ): Promise<void> {
    const to = await getAdminEmail();
    const lines = [
      'A website gate access request could not be completed.',
      '',
      ...gateAccessDetailLines(data),
      '',
      'Error:',
      data.errorMessage || 'Unknown error'
    ];
    if (data.errorStack) {
      lines.push('', 'Details:', data.errorStack);
    }
    lines.push('', '— Santa Maria Bouar');
    await sendMail({
      to,
      subject: `Gate access request failed — ${data.apartmentLabel}`,
      text: lines.join('\n')
    });
  }

  public async sendGateAccessApproved(data: {
    to: string;
    ownerName: string;
    apartmentLabel: string;
    action: 'add' | 'remove';
    targetName: string;
    relation?: string | null;
    expiryDate?: string | null;
  }): Promise<void> {
    const gateAccessUrl = `${getBaseUrl()}/account/gate-access`;
    const isRemove = data.action === 'remove';
    const summary = isRemove
      ? `Your request to remove main gate access for ${data.targetName} at ${data.apartmentLabel} has been approved.`
      : `Your request to add main gate access for ${data.targetName} at ${data.apartmentLabel} has been approved.`;

    const lines: Array<string | null> = [
      `Hello ${data.ownerName},`,
      '',
      summary,
      '',
      `Apartment: ${data.apartmentLabel}`,
      `Person: ${data.targetName}`,
      data.relation ? `Relation: ${data.relation}` : null,
      !isRemove
        ? data.expiryDate
          ? `Expires: ${data.expiryDate}`
          : 'Expires: no expiry'
        : null,
      ''
    ];

    if (!isRemove) {
      lines.push(
        'Next step for the person granted access:',
        'Install the Safemate app, then log in with their phone number (without country code) and password 12345678.',
        '',
        `View gate access: ${gateAccessUrl}`,
        ''
      );
    }

    lines.push('— Santa Maria Bouar');

    await sendMail({
      to: data.to,
      subject: `Gate access request approved — ${data.apartmentLabel}`,
      text: lines.filter((line) => line !== null).join('\n')
    });
  }

  public async sendGateAccessRejected(data: {
    to: string;
    ownerName: string;
    apartmentLabel: string;
    action: 'add' | 'remove';
    targetName: string;
  }): Promise<void> {
    const actionLabel = data.action === 'remove' ? 'remove' : 'add';
    await sendMail({
      to: data.to,
      subject: `Gate access request update — ${data.apartmentLabel}`,
      text: [
        `Hello ${data.ownerName},`,
        '',
        `Your request to ${actionLabel} main gate access for ${data.targetName} at ${data.apartmentLabel} was not approved.`,
        'Please contact the administration office if you have questions.',
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendGateAccessExpiredDigest(items: Array<{
    apartmentLabel: string;
    userName: string;
    userEmail?: string;
    userPhone?: string;
    relation: string;
    expiryDate: string;
  }>): Promise<void> {
    if (!items.length) {
      return;
    }

    const to = await getAdminEmail();
    const reportUrl = `${getBaseUrl()}/admin/main-gate-access`;
    const count = items.length;
    const lines = items.map((item, index) => {
      return [
        `${index + 1}. ${item.userName}`,
        `   Apartment: ${item.apartmentLabel}`,
        `   Relation: ${item.relation}`,
        `   Phone: ${item.userPhone || '—'}`,
        `   Email: ${item.userEmail || '—'}`,
        `   Expired: ${item.expiryDate}`
      ].join('\n');
    });

    await sendMail({
      to,
      subject: `Expired main gate access — ${count} entr${count === 1 ? 'y' : 'ies'}`,
      text: [
        `${count} main gate access entr${count === 1 ? 'y has' : 'ies have'} expired.`,
        '',
        ...lines,
        '',
        `Report: ${reportUrl}`,
        '',
        '— Santa Maria Bouar'
      ].join('\n')
    });
  }

  public async sendPhotoUploadNotification(data: {
    apartmentLabel: string;
    uploaderName: string;
    uploaderEmail?: string;
    uploaderPhone?: string;
    filenames: string[];
  }): Promise<void> {
    const to = await getAdminEmail();
    const reviewUrl = `${getBaseUrl()}/admin/photo-approvals`;
    const count = data.filenames.length;
    const fileList = data.filenames.map((name) => `  - ${name}`).join('\n');
    await sendMail({
      to,
      subject: `New apartment photo${count === 1 ? '' : 's'} pending approval — ${data.apartmentLabel}`,
      text: [
        `${count} photo${count === 1 ? '' : 's'} uploaded and need approval.`,
        '',
        `Apartment: ${data.apartmentLabel}`,
        `Uploaded by: ${data.uploaderName}`,
        data.uploaderEmail ? `Email: ${data.uploaderEmail}` : null,
        data.uploaderPhone ? `Phone: ${data.uploaderPhone}` : null,
        'Files:',
        fileList,
        '',
        `Review: ${reviewUrl}`
      ].filter((line) => line !== null).join('\n')
    });
  }

  public async sendInvoicePaymentReceipt(data: {
    to: string | string[];
    apartmentLabel: string;
    invoiceDescription: string;
    categoryName: string;
    paymentDate: string;
    cashAmount: number;
    walletAmount: number;
    totalAmount: number;
    invoiceTotal: number;
    balanceRemaining: number;
    loginUrl: string;
    paymentsUrl: string;
  }): Promise<void> {
    const logoUrl = await getBrandedLogoUrl();

    const paymentLines: string[] = [];
    if (data.walletAmount > 0) {
      paymentLines.push(`From wallet: ${formatMoney(data.walletAmount)}`);
    }
    if (data.cashAmount > 0) {
      paymentLines.push(`Cash: ${formatMoney(data.cashAmount)}`);
    }

    const subject = `Payment received — ${data.apartmentLabel}`;
    const text = [
      'Hello,',
      '',
      'We have received a payment for your apartment invoice.',
      '',
      `Apartment: ${data.apartmentLabel}`,
      `Invoice: ${data.invoiceDescription}`,
      `Category: ${data.categoryName}`,
      `Payment date: ${data.paymentDate}`,
      ...paymentLines,
      `Total paid: ${formatMoney(data.totalAmount)}`,
      `Invoice total: ${formatMoney(data.invoiceTotal)}`,
      `Remaining balance: ${formatMoney(data.balanceRemaining)}`,
      '',
      'Log in to view your payment history online:',
      data.loginUrl,
      '',
      'Payment History (after login):',
      data.paymentsUrl,
      '',
      '— Santa Maria Bouar'
    ].join('\n');

    const paymentRowsHtml = [
      data.walletAmount > 0
        ? `<tr><td style="padding:6px 0;color:#555;">From wallet</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(formatMoney(data.walletAmount))}</td></tr>`
        : '',
      data.cashAmount > 0
        ? `<tr><td style="padding:6px 0;color:#555;">Cash</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(formatMoney(data.cashAmount))}</td></tr>`
        : ''
    ].join('');

    const bodyHtml = `
              <p style="margin:0 0 16px;font-size:16px;">Hello,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#444;">
                We have received a payment for your apartment invoice. Details are below.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:20px;">
                <tr><td style="padding:6px 0;color:#555;">Apartment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(data.apartmentLabel)}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Invoice</td><td style="padding:6px 0;text-align:right;">${escapeHtml(data.invoiceDescription)}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Category</td><td style="padding:6px 0;text-align:right;">${escapeHtml(data.categoryName)}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Payment date</td><td style="padding:6px 0;text-align:right;">${escapeHtml(data.paymentDate)}</td></tr>
                ${paymentRowsHtml}
                <tr><td style="padding:10px 0 6px;color:#222;font-weight:700;border-top:1px solid #eee;">Total paid</td><td style="padding:10px 0 6px;text-align:right;font-weight:700;border-top:1px solid #eee;">${escapeHtml(formatMoney(data.totalAmount))}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Invoice total</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatMoney(data.invoiceTotal))}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Remaining balance</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatMoney(data.balanceRemaining))}</td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="border-radius:6px;background:#1a5f4a;">
                    <a href="${escapeHtml(data.loginUrl)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                      Log in to Payment History
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#777;text-align:center;">
                Or open Payment History after signing in:<br>
                <a href="${escapeHtml(data.paymentsUrl)}" style="color:#1a5f4a;word-break:break-all;">${escapeHtml(data.paymentsUrl)}</a>
              </p>`;

    await sendMail({
      to: data.to,
      subject,
      text,
      html: wrapBrandedEmailHtml(logoUrl, bodyHtml)
    });
  }

  public async sendWalletTransactionReceipt(data: {
    to: string | string[];
    apartmentLabel: string;
    kind: 'deposit' | 'deduction';
    amount: number;
    date: string;
    description: string;
    newBalance: number;
    loginUrl: string;
    walletUrl: string;
  }): Promise<void> {
    const logoUrl = await getBrandedLogoUrl();
    const isDeposit = data.kind === 'deposit';
    const subject = isDeposit
      ? `Wallet credit — ${data.apartmentLabel}`
      : `Wallet deduction — ${data.apartmentLabel}`;
    const intro = isDeposit
      ? 'We have added a credit to your apartment wallet. Details are below.'
      : 'We have recorded a deduction from your apartment wallet. Details are below.';
    const amountLabel = isDeposit ? 'Amount credited' : 'Amount deducted';

    const text = [
      'Hello,',
      '',
      intro,
      '',
      `Apartment: ${data.apartmentLabel}`,
      `Date: ${data.date}`,
      data.description ? `Description: ${data.description}` : null,
      `${amountLabel}: ${formatMoney(data.amount)}`,
      `New wallet balance: ${formatMoney(data.newBalance)}`,
      '',
      'Log in to view your wallet online:',
      data.loginUrl,
      '',
      'Wallet (after login):',
      data.walletUrl,
      '',
      '— Santa Maria Bouar'
    ].filter((line) => line !== null).join('\n');

    const descriptionRow = data.description
      ? `<tr><td style="padding:6px 0;color:#555;">Description</td><td style="padding:6px 0;text-align:right;">${escapeHtml(data.description)}</td></tr>`
      : '';

    const bodyHtml = `
              <p style="margin:0 0 16px;font-size:16px;">Hello,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#444;">
                ${escapeHtml(intro)}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:20px;">
                <tr><td style="padding:6px 0;color:#555;">Apartment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(data.apartmentLabel)}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">Date</td><td style="padding:6px 0;text-align:right;">${escapeHtml(data.date)}</td></tr>
                ${descriptionRow}
                <tr><td style="padding:10px 0 6px;color:#222;font-weight:700;border-top:1px solid #eee;">${escapeHtml(amountLabel)}</td><td style="padding:10px 0 6px;text-align:right;font-weight:700;border-top:1px solid #eee;">${escapeHtml(formatMoney(data.amount))}</td></tr>
                <tr><td style="padding:6px 0;color:#555;">New wallet balance</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatMoney(data.newBalance))}</td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="border-radius:6px;background:#1a5f4a;">
                    <a href="${escapeHtml(data.loginUrl)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                      Log in to Wallet
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#777;text-align:center;">
                Or open Wallet after signing in:<br>
                <a href="${escapeHtml(data.walletUrl)}" style="color:#1a5f4a;word-break:break-all;">${escapeHtml(data.walletUrl)}</a>
              </p>`;

    await sendMail({
      to: data.to,
      subject,
      text,
      html: wrapBrandedEmailHtml(logoUrl, bodyHtml)
    });
  }

  public async sendContactMessage(data: {
    fullName: string;
    email: string;
    phone: string;
    subject: string;
    subjectLabel: string;
    message: string;
    apartment?: string;
    workType?: string;
    workFrom?: string;
    workTo?: string;
    eventDate?: string;
    eventTime?: string;
    poolDate?: string;
    poolTime?: string;
    mapAttachment?: { filename: string; path: string };
  }): Promise<void> {
    const to = await getAdminEmail();
    const lines = [
      'A new message was submitted through the contact form.',
      '',
      `Subject: ${data.subjectLabel}`,
      `Name: ${data.fullName}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`
    ];

    if (data.apartment) {
      lines.push(`Apartment: ${data.apartment}`);
    }
    if (data.workType) {
      lines.push(`Work type: ${data.workType}`);
    }
    if (data.workFrom || data.workTo) {
      lines.push(`Work duration: ${data.workFrom || '—'} to ${data.workTo || '—'}`);
    }
    if (data.eventDate || data.eventTime) {
      lines.push(`Event date/time: ${data.eventDate || '—'} ${data.eventTime || ''}`.trim());
    }
    if (data.poolDate || data.poolTime) {
      lines.push(`Pool reservation: ${data.poolDate || '—'} at ${data.poolTime || '—'}`);
    }

    lines.push('', 'Message:', data.message);

    if (data.mapAttachment) {
      lines.push('', 'A site map / location photo is attached to this email.');
    }

    await sendMail({
      to,
      subject: `Contact form: ${data.subjectLabel} — ${data.fullName}`,
      text: lines.join('\n'),
      attachments: data.mapAttachment ? [data.mapAttachment] : undefined
    });
  }
}

export const emailService = new EmailService();

const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
const apartmentWalletService = ApartmentWalletService.getInstance();

/**
 * Fire-and-forget: email owner and tenants after a successful invoice payment.
 * Never throws — payment flows must not fail because of email.
 */
export async function notifyOwnerOfInvoicePayment(params: {
  invoiceId: number;
  cashAmount: number;
  walletAmount: number;
  paymentDate: string;
  transactionId?: number;
}): Promise<void> {
  try {
    const cashAmount = Math.round((params.cashAmount || 0) * 100) / 100;
    const walletAmount = Math.round((params.walletAmount || 0) * 100) / 100;
    if (cashAmount <= 0 && walletAmount <= 0) {
      return;
    }

    const invoice = await invoicesService.getInvoiceById(params.invoiceId);
    if (!invoice) {
      console.warn(`[payment-email] Invoice ${params.invoiceId} not found; skipping owner email`);
      return;
    }

    const apartment = await apartmentsService.getApartmentById(invoice.apartmentId);
    if (!apartment) {
      console.warn(`[payment-email] Apartment ${invoice.apartmentId} not found; skipping owner email`);
      return;
    }

    const recipients = await getApartmentPaymentRecipients(invoice.apartmentId);
    if (recipients.length === 0) {
      console.warn(
        `[payment-email] No owner or tenant email for apartment ${apartment.id}; skipping`
      );
      return;
    }

    const category = await categoriesService.getCategoryById(invoice.categoryId);
    const label = apartmentLabel(apartment);
    const paymentsPath = '/account/transactions';
    const paymentsUrl = `${getBaseUrl()}${paymentsPath}`;
    const loginUrl = `${getBaseUrl()}/account/login?redirect=${encodeURIComponent(paymentsPath)}`;
    const balanceRemaining = Math.round(Math.max(0, invoice.amount - invoice.amountPaid) * 100) / 100;

    await emailService.sendInvoicePaymentReceipt({
      to: recipients,
      apartmentLabel: label,
      invoiceDescription: invoice.description || category?.name || `Invoice #${invoice.id}`,
      categoryName: category?.name || '—',
      paymentDate: params.paymentDate,
      cashAmount,
      walletAmount,
      totalAmount: Math.round((cashAmount + walletAmount) * 100) / 100,
      invoiceTotal: invoice.amount,
      balanceRemaining,
      loginUrl,
      paymentsUrl
    });
  } catch (error) {
    console.error('[payment-email] Failed to notify owner of invoice payment:', error);
  }
}

/**
 * Fire-and-forget: email owner and tenants after a wallet deposit or deduction.
 * Never throws — wallet flows must not fail because of email.
 */
export async function notifyApartmentOfWalletTransaction(params: {
  apartmentId: number;
  kind: 'deposit' | 'deduction';
  amount: number;
  date: string;
  description?: string;
}): Promise<void> {
  try {
    const amount = Math.round((params.amount || 0) * 100) / 100;
    if (amount <= 0) {
      return;
    }

    const apartment = await apartmentsService.getApartmentById(params.apartmentId);
    if (!apartment) {
      console.warn(`[payment-email] Apartment ${params.apartmentId} not found; skipping wallet email`);
      return;
    }

    const recipients = await getApartmentPaymentRecipients(params.apartmentId);
    if (recipients.length === 0) {
      console.warn(
        `[payment-email] No owner or tenant email for apartment ${apartment.id}; skipping wallet email`
      );
      return;
    }

    const walletPath = '/account/wallet';
    const walletUrl = `${getBaseUrl()}${walletPath}`;
    const loginUrl = `${getBaseUrl()}/account/login?redirect=${encodeURIComponent(walletPath)}`;
    const newBalance = Math.round((await apartmentWalletService.getTotalBalance(params.apartmentId)) * 100) / 100;

    await emailService.sendWalletTransactionReceipt({
      to: recipients,
      apartmentLabel: apartmentLabel(apartment),
      kind: params.kind,
      amount,
      date: params.date,
      description: (params.description || '').trim(),
      newBalance,
      loginUrl,
      walletUrl
    });
  } catch (error) {
    console.error('[payment-email] Failed to notify apartment of wallet transaction:', error);
  }
}

/**
 * Fire-and-forget: after a common-expense payment, email invoice receipts and any wallet credit.
 */
export async function notifyAfterCommonExpensePayment(params: {
  transactionId: number;
  apartmentId: number;
  paymentDate: string;
  description?: string;
}): Promise<void> {
  try {
    const allocations = await invoiceTransactionsService.getByTransactionId(params.transactionId);
    for (const allocation of allocations) {
      if (allocation.invoiceId) {
        await notifyOwnerOfInvoicePayment({
          invoiceId: allocation.invoiceId,
          cashAmount: allocation.amount,
          walletAmount: 0,
          paymentDate: params.paymentDate,
          transactionId: params.transactionId
        });
      } else if (allocation.amount > 0) {
        await notifyApartmentOfWalletTransaction({
          apartmentId: params.apartmentId,
          kind: 'deposit',
          amount: allocation.amount,
          date: params.paymentDate,
          description: params.description
        });
      }
    }
  } catch (error) {
    console.error('[payment-email] Failed after common-expense payment:', error);
  }
}
