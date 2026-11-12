import { EventEmitter } from 'node:events';

export type ContentKind = 'article' | 'section' | 'book' | 'hymn' | 'album' | 'video' | 'purchase' | 'page' | 'home' | 'menu' | 'settings';

export interface ContentChange {
  kind: ContentKind;
  /** Record id, or null when many records changed at once. */
  id: number | null;
}

/** Services announce saved content here; the search index and the public page cache listen. */
class ContentEvents extends EventEmitter<{ changed: [ContentChange] }> {
  public changed(kind: ContentKind, id: number | null = null): void {
    this.emit('changed', { kind, id });
  }
}

export const contentEvents = new ContentEvents();
