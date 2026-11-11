export type UserRole = 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid';

export interface ProfileApartment {
  id: number;
  label: string;
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial: string;
  memberRole: 'owner' | 'tenant';
  isPrimaryOwner: boolean;
}

export interface Profile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  walletEnabled: boolean;
  isAdmin: boolean;
  canWriteAdmin: boolean;
  apartments: ProfileApartment[];
}

export interface TokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface LoginResponse extends TokenResponse {
  user: Profile;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// ---------- Member ----------

export interface MemberApartment {
  id: number;
  label: string;
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial: string;
  areaInM2: number;
  status: string | null;
  isVacant: boolean;
  memberRole: 'owner' | 'tenant';
  isPrimaryOwner: boolean;
  ownerName: string | null;
  renterName: string | null;
  officialImage: string | null;
}

export interface MemberInvoice {
  id: number;
  apartmentId: number;
  apartmentLabel: string;
  description: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string | null;
  year: number | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface MemberTransaction {
  id: string;
  transactionId: number | null;
  apartmentId: number;
  apartmentLabel: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  description: string;
  hasReceipt: boolean;
  isWalletPayment: boolean;
  invoiceId: number | null;
}

export interface WalletEntryView {
  id: number;
  date: string;
  description: string;
  amount: number;
  runningBalance: number;
  accountName?: string | null;
  source?: string;
}

export interface PaymentInstructions {
  coordinatorName: string;
  coordinatorPhone: string;
  settings: {
    whishEnabled: boolean;
    whishDetails: string;
    omtEnabled: boolean;
    omtDetails: string;
    bankTransferEnabled: boolean;
    bankInfo: string;
  } | null;
  yearlyInterestRate: number;
}

export interface MemberDashboard {
  apartments: MemberApartment[];
  paymentsDue: MemberInvoice[];
  totalDue: number;
  walletEnabled: boolean;
  walletTotal: number | null;
  paymentInstructions: PaymentInstructions;
}

export interface MemberApartmentDetail {
  apartment: MemberApartment;
  paymentsDue: MemberInvoice[];
  transactions: MemberTransaction[];
  wallet: { balance: number; entries: WalletEntryView[] } | null;
}

export interface MemberWallet {
  walletEnabled: boolean;
  total: number;
  wallets: { apartmentId: number; apartmentLabel: string; balance: number; entries: WalletEntryView[] }[];
}

export interface ApartmentOption {
  id: number;
  label: string;
  ownerId?: number | null;
  ownerName?: string | null;
}

// ---------- Admin ----------

export interface AdminDashboard {
  pendingAccessRequests: number;
  unpaidInvoices: { count: number; totalBalance: number };
  wallets: { totalBalance: number; apartmentsWithBalance: number; entryCount: number };
  transactions: { totalIncome: number; totalExpenses: number; balance: number; transactionCount: number };
}

export interface Account {
  id: number;
  name: string;
  currency: string;
  balance: number;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense' | 'both';
  color: string;
  supportedOnMobile: boolean;
}

export interface AdminTransaction {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  description: string;
  accountId: number;
  accountName: string | null;
  categoryId: number;
  categoryName: string | null;
  categoryColor: string | null;
  apartmentId: number | null;
  apartmentLabel: string | null;
  invoiceId: number | null;
  hasReceipt: boolean;
}

export interface AdminInvoice {
  id: number;
  apartmentId: number;
  apartmentLabel: string;
  ownerName: string | null;
  description: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string | null;
  year: number | null;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface InvoiceList extends Paginated<AdminInvoice> {
  summary: { count: number; totalAmount: number; totalPaid: number; totalBalance: number };
}

export interface AdminInvoiceDetail extends AdminInvoice {
  notes: string | null;
  categoryId: number;
  walletBalance: number;
  breakdown: {
    totalPaid: number;
    walletAmount: number;
    cashAmount: number;
    [key: string]: unknown;
  };
}

export interface WalletRow {
  apartmentId: number;
  label: string;
  ownerName: string | null;
  balance: number;
}

export interface WalletList extends Paginated<WalletRow> {
  summary: AdminDashboard['wallets'];
}

export interface WalletDetail {
  apartmentId: number;
  label: string;
  ownerName: string | null;
  balance: number;
  totalAdded: number;
  totalSubtracted: number;
  entries: WalletEntryView[];
}

export interface AccessRequestApartment {
  id: number;
  label: string;
  block: string;
  unitNumberOfficial: string;
  unitNumberUnofficial: string;
  ownerId: number | null;
  ownerName: string | null;
  role: 'owner' | 'tenant';
}

export interface AccessRequest {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  apartments: AccessRequestApartment[];
}

export interface MemberOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface AccessRequestDetail {
  request: AccessRequest;
  members: MemberOption[];
  matchingMemberId: number | null;
  suggestedMemberIds: number[];
}

export interface ApproveAccessResult {
  message: string;
  userId: number;
  emailSent: boolean;
  tempPassword: string | null;
}
