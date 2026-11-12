import { z } from 'zod';

/** One card on a legacy listing page (`ul.page-list`). */
export const crawlListingItemSchema = z.object({
  path: z.string(),
  title: z.string(),
  summary: z.string(),
  image: z.string(),
  legacyId: z.number().int().nullable()
});
export type CrawlListingItem = z.infer<typeof crawlListingItemSchema>;

export const crawlHymnSchema = z.object({
  legacyId: z.number().int().nullable(),
  title: z.string(),
  file: z.string(),
  singer: z.string(),
  author: z.string(),
  album: z.string(),
  category: z.string()
});
export type CrawlHymn = z.infer<typeof crawlHymnSchema>;

export const crawlVideoThumbSchema = z.object({ path: z.string(), title: z.string(), image: z.string() });

export const crawledPageSchema = z.object({
  path: z.string(),
  /** Query string page number for paged listings (1 for the first page). */
  pageNumber: z.number().int().min(1),
  status: z.number().int(),
  /** Final path after the legacy server's own redirects. */
  finalPath: z.string(),
  title: z.string(),
  bodyHtml: z.string(),
  listing: z.array(crawlListingItemSchema),
  lastPageNumber: z.number().int().min(1),
  hymns: z.array(crawlHymnSchema),
  hymnCategories: z.array(z.string()),
  albumImages: z.array(z.string()),
  isAlbum: z.boolean(),
  youtubeId: z.string(),
  videoThumbs: z.array(crawlVideoThumbSchema),
  links: z.array(z.string())
});
export type CrawledPage = z.infer<typeof crawledPageSchema>;
export const crawledPagesFileSchema = z.array(crawledPageSchema);

export const coverageSchema = z.object({
  crawledAt: z.string(),
  pagesFetched: z.number().int(),
  pagesFailed: z.array(z.object({ path: z.string(), status: z.number().int() })),
  legacyPageIdsFound: z.number().int(),
  localPageFolders: z.number().int(),
  unreachablePageFolders: z.array(z.number().int()),
  localAlbumFolders: z.number().int(),
  albumsFound: z.array(z.number().int()),
  unreachableAlbumFolders: z.array(z.number().int())
});
export type Coverage = z.infer<typeof coverageSchema>;

/** Decodes, NFC-normalizes and trims a legacy path; keeps Arabic as-is and lowercases Latin-only segments. */
export function normalizeLegacyPath(raw: string): string {
  let value = raw.trim().replace(/\\/g, '/');
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value when it holds a stray % sign.
  }
  value = value.normalize('NFC').split('#')[0]?.split('?')[0] ?? '';
  const segments = value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => (/^[\x20-\x7e]+$/.test(segment) ? segment.toLowerCase() : segment));
  return `/${segments.join('/')}`;
}

export function legacyIdFromPath(url: string): number | null {
  const match = /Page_(\d+)/i.exec(url);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
