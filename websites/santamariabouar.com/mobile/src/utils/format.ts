import i18n from '@/i18n';

export function formatMoney(value: number | null | undefined): string {
  const amount = Number(value || 0);
  const formatted = Math.abs(amount).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${amount < 0 ? '-' : ''}$${formatted}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function stripHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Drops input hints such as "(YYYY-MM-DD)" or "($)" from a form label for read-only display. */
export function plainLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '');
}

export function parseAmountInput(value: string): number {
  return Math.round(parseFloat(String(value).replace(',', '.')) * 100) / 100;
}
