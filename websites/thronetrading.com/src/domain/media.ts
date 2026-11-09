export const THUMB_SUFFIX = '-thumb';

export function isThumbFile(url: string): boolean {
  return url.toLowerCase().endsWith(`${THUMB_SUFFIX}.webp`);
}

export function thumbUrl(url: string): string {
  if (!url.startsWith('/uploads/') || !url.toLowerCase().endsWith('.webp') || isThumbFile(url)) {
    return url;
  }
  return `${url.slice(0, -'.webp'.length)}${THUMB_SUFFIX}.webp`;
}
