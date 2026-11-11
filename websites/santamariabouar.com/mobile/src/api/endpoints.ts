import { apiHtml, apiRequest } from './client';
import type {
  Account,
  AccessRequest,
  AccessRequestDetail,
  AdminDashboard,
  AdminInvoiceDetail,
  AdminTransaction,
  ApartmentOption,
  ApproveAccessResult,
  Category,
  InvoiceList,
  LoginResponse,
  MemberApartment,
  MemberApartmentDetail,
  MemberDashboard,
  MemberInvoice,
  MemberTransaction,
  MemberWallet,
  Paginated,
  Profile,
  TokenResponse,
  WalletDetail,
  WalletList
} from './types';

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const authApi = {
  login: (login: string, password: string, deviceName?: string) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: { login, password, deviceName }, auth: false }),
  logout: (refreshToken: string) =>
    apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  me: () => apiRequest<Profile>('/auth/me'),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  apartmentDirectory: () => apiRequest<ApartmentOption[]>('/auth/apartments', { auth: false }),
  requestAccess: (body: {
    fullName: string;
    email: string;
    phone: string;
    acceptTerms: boolean;
    apartments: { apartmentId: number; role: 'owner' | 'tenant' }[];
  }) => apiRequest<{ message: string }>('/auth/request-access', { method: 'POST', body, auth: false })
};

export const memberApi = {
  dashboard: () => apiRequest<MemberDashboard>('/me/dashboard'),
  apartments: () => apiRequest<MemberApartment[]>('/me/apartments'),
  apartment: (id: number) => apiRequest<MemberApartmentDetail>(`/me/apartments/${id}`),
  invoices: (status: 'unpaid' | 'all') => apiRequest<MemberInvoice[]>(`/me/invoices${query({ status })}`),
  transactions: () => apiRequest<MemberTransaction[]>('/me/transactions'),
  wallet: () => apiRequest<MemberWallet>('/me/wallet'),
  transactionReceipt: (id: number) => apiHtml(`/me/transactions/${id}/receipt`),
  invoiceReceipt: (id: number) => apiHtml(`/me/invoices/${id}/receipt`),
  changePassword: (currentPassword: string, newPassword: string, deviceName?: string) =>
    apiRequest<{ message: string; tokens: TokenResponse | null }>('/me/password', {
      method: 'POST',
      body: { currentPassword, newPassword, deviceName }
    })
};

export interface TransactionFilters {
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  apartmentId?: number;
  page?: number;
}

export interface InvoiceFilters {
  status?: 'partial-unpaid' | 'unpaid' | 'partial' | 'paid' | 'all';
  search?: string;
  apartmentId?: number;
  page?: number;
}

export const adminApi = {
  dashboard: () => apiRequest<AdminDashboard>('/admin/dashboard'),
  accounts: () => apiRequest<Account[]>('/admin/accounts'),
  categories: () => apiRequest<Category[]>('/admin/transaction-categories'),
  apartments: (search: string) => apiRequest<ApartmentOption[]>(`/admin/apartments${query({ search })}`),

  transactions: (filters: TransactionFilters) =>
    apiRequest<Paginated<AdminTransaction>>(`/admin/transactions${query({ ...filters })}`),
  createTransaction: (body: {
    categoryId: number;
    accountId: number;
    toAccountId?: number;
    amount: number;
    date: string;
    description: string;
    type?: 'income' | 'expense';
    apartmentId?: number | null;
  }) => apiRequest<{ id: number }>('/admin/transactions', { method: 'POST', body }),

  invoices: (filters: InvoiceFilters) => apiRequest<InvoiceList>(`/admin/invoices${query({ ...filters })}`),
  invoice: (id: number) => apiRequest<AdminInvoiceDetail>(`/admin/invoices/${id}`),
  createInvoice: (body: {
    apartmentId: number;
    categoryId: number;
    amount: number;
    description: string;
    invoiceDate: string;
    dueDate?: string | null;
    year?: number | null;
    notes?: string | null;
  }) => apiRequest<{ id: number }>('/admin/invoices', { method: 'POST', body }),
  payInvoice: (
    id: number,
    body: { cashAmount: number; walletAmount: number; date: string; accountId?: number | null; description?: string }
  ) =>
    apiRequest<{ message: string; transactionId: number | null; walletAllocated: number }>(
      `/admin/invoices/${id}/pay`,
      { method: 'POST', body }
    ),

  wallets: (search: string, withBalance: boolean, page = 1) =>
    apiRequest<WalletList>(`/admin/wallets${query({ search, withBalance: withBalance ? 1 : undefined, page })}`),
  wallet: (apartmentId: number) => apiRequest<WalletDetail>(`/admin/wallets/${apartmentId}`),
  walletEntry: (
    apartmentId: number,
    kind: 'add' | 'subtract',
    body: { amount: number; accountId: number; date: string; description: string }
  ) =>
    apiRequest<{ message: string; balance: number }>(`/admin/wallets/${apartmentId}/${kind}`, {
      method: 'POST',
      body
    }),

  accessRequests: () => apiRequest<AccessRequest[]>('/admin/access-requests'),
  accessRequest: (id: number) => apiRequest<AccessRequestDetail>(`/admin/access-requests/${id}`),
  approveAccessRequest: (
    id: number,
    body: {
      linkMode: 'create' | 'existing';
      userId?: number | null;
      fullName: string;
      email: string;
      phone: string;
      apartmentIds: number[];
      apartmentRoles: Record<string, 'owner' | 'tenant'>;
      apartmentActions: Record<string, 'add_owner' | 'transfer_primary'>;
    }
  ) => apiRequest<ApproveAccessResult>(`/admin/access-requests/${id}/approve`, { method: 'POST', body }),
  transactionReceipt: (id: number) => apiHtml(`/admin/transactions/${id}/receipt`),
  invoiceReceipt: (id: number) => apiHtml(`/admin/invoices/${id}/receipt`),
  rejectAccessRequest: (id: number) =>
    apiRequest<{ message: string }>(`/admin/access-requests/${id}/reject`, { method: 'POST' })
};
