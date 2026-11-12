/** Files uploaded through admin; imported legacy files and the seeded site logo are never deleted by edits. */
export function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}
