export const searchTypes = ['article', 'book', 'hymn', 'album', 'video', 'page'] as const;
export type SearchType = (typeof searchTypes)[number];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  article: 'مقالات',
  book: 'المكتبة',
  hymn: 'تراتيل',
  album: 'ألبومات الصور',
  video: 'فيديو',
  page: 'صفحات'
};
