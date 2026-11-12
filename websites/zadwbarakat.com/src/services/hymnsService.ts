import type { Hymn } from '../domain/models.js';
import { BadRequestError, NotFoundError } from '../errors/httpError.js';
import { hymnsRepository } from '../repositories/contentRepositories.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import type { HymnFormInput } from '../schemas/adminSchemas.js';
import { contentEvents } from './contentEvents.js';
import { searchService } from './searchService.js';
import { isOwnedUpload } from './uploadOwnership.js';

export interface HymnQuery {
  q: string;
  category: string;
}

export interface HymnsResult {
  hymns: Hymn[];
  categories: { name: string; count: number }[];
  total: number;
}

function bySort(a: Hymn, b: Hymn): number {
  return a.sort - b.sort || a.id - b.id;
}

export class HymnsService {
  public async browse(query: HymnQuery): Promise<HymnsResult> {
    const active = (await hymnsRepository.findAll()).filter((hymn) => hymn.active && hymn.file);
    let hymns: Hymn[];
    if (query.q) {
      const byId = new Map(active.map((hymn) => [hymn.id, hymn]));
      hymns = (await searchService.rankedIds('hymn', query.q)).map((id) => byId.get(id)).filter((hymn): hymn is Hymn => hymn !== undefined);
    } else {
      hymns = [...active].sort(bySort);
    }
    const map = new Map<string, number>();
    for (const hymn of hymns) {
      if (hymn.category) {
        map.set(hymn.category, (map.get(hymn.category) ?? 0) + 1);
      }
    }
    const filtered = query.category ? hymns.filter((hymn) => hymn.category === query.category) : hymns;
    return {
      hymns: filtered,
      categories: [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
      total: active.length
    };
  }

  public async latest(count: number): Promise<Hymn[]> {
    return (await hymnsRepository.findAll())
      .filter((hymn) => hymn.active && hymn.file)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || bySort(a, b))
      .slice(0, count);
  }

  public async list(): Promise<Hymn[]> {
    return (await hymnsRepository.findAll()).sort(bySort);
  }

  public async categories(): Promise<string[]> {
    return [...new Set((await hymnsRepository.findAll()).map((hymn) => hymn.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  }

  public async getById(id: number): Promise<Hymn> {
    const hymn = await hymnsRepository.findById(id);
    if (!hymn) {
      throw new NotFoundError('Hymn not found.');
    }
    return hymn;
  }

  public async create(input: HymnFormInput, uploadedFile: string | null): Promise<Hymn> {
    const file = uploadedFile ?? input.file;
    if (!file) {
      throw new BadRequestError('Please correct the highlighted fields.', { file: 'Upload the MP3 file' });
    }
    const now = new Date().toISOString();
    const created = await hymnsRepository.insert({ legacyId: null, ...input, file, createdAt: now, updatedAt: now });
    contentEvents.changed('hymn', created.id);
    return created;
  }

  public async update(id: number, input: HymnFormInput, uploadedFile: string | null): Promise<Hymn> {
    const existing = await this.getById(id);
    if (!uploadedFile && !input.file) {
      throw new BadRequestError('Please correct the highlighted fields.', {
        file: 'A hymn needs its audio file. Upload a replacement MP3, or delete the hymn from the list.'
      });
    }
    const file = uploadedFile ?? input.file;
    if (existing.file !== file && isOwnedUpload(existing.file)) {
      await mediaRepository.remove(existing.file);
    }
    const saved = await hymnsRepository.replace({ ...existing, ...input, file, updatedAt: new Date().toISOString() });
    contentEvents.changed('hymn', id);
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await hymnsRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Hymn not found.');
    }
    if (isOwnedUpload(removed.file)) {
      await mediaRepository.remove(removed.file);
    }
    contentEvents.changed('hymn', id);
  }
}

export const hymnsService = new HymnsService();
