import * as fs from 'fs';
import * as path from 'path';
import { AdminNewsData } from '../../admin/services/newsService';
import { DATA_PATHS } from '../constants/data-paths';

export interface NewsView {
  key: string;
  title: string;
  url: string;
  image: string;
  date: string;
  dateIso: string;
  category: string;
  excerpt: string;
  body: string;
}

const decodeEntities = (value: string): string => value
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const localUploadExists = (src: string): boolean => {
  if (!src.startsWith('/uploads/')) return true;
  const file = path.join(DATA_PATHS.ROOT_DIR, 'public', decodeURIComponent(src.split(/[?#]/)[0]));
  return fs.existsSync(file);
};

export const newsBody = (html?: string): string => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/\ssrc=["']([^"']+)["']/i) || [])[1] || '';
    return localUploadExists(src) ? tag.replace(/\s(srcset|sizes)=["'][^"']*["']/gi, '') : '';
  })
  .trim();

export const newsExcerpt = (html?: string, length = 220): string => {
  const text = decodeEntities(newsBody(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, '')}…`;
};

const formatDate = (value?: string): { date: string; dateIso: string } => {
  const parsed = value ? new Date(value.replace(' ', 'T')) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return { date: '', dateIso: '' };
  return {
    date: parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    dateIso: parsed.toISOString()
  };
};

export const toNewsView = (item: AdminNewsData): NewsView => ({
  key: item.key,
  title: item.title,
  url: item.url || `/news/${item.key}`,
  image: item.pageImage || item.seo?.pageImage || '',
  ...formatDate(item.lastUpdated),
  category: item.category || '',
  excerpt: newsExcerpt(item.content),
  body: newsBody(item.content)
});
