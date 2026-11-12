import type { z } from 'zod';
import type { Partner } from '../domain/models.js';
import { NotFoundError } from '../errors/httpError.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { partnersRepository } from '../repositories/partnersRepository.js';
import type { partnerFormSchema } from '../schemas/adminSchemas.js';
import type { UploadedImage } from './pagesService.js';

type PartnerInput = z.infer<typeof partnerFormSchema>;

function isOwnedUpload(url: string): boolean {
  return url.startsWith('/uploads/') && !url.startsWith('/uploads/legacy/') && !url.startsWith('/uploads/site/');
}

export class PartnersService {
  public async list(): Promise<Partner[]> {
    return partnersRepository.findAll();
  }

  public async listActive(): Promise<Partner[]> {
    return (await partnersRepository.findAll()).filter((partner) => partner.active && partner.logo !== '');
  }

  public async get(id: number): Promise<Partner> {
    const partner = await partnersRepository.findById(id);
    if (!partner) {
      throw new NotFoundError('Partner not found.');
    }
    return partner;
  }

  public async create(input: PartnerInput, logo: UploadedImage | null): Promise<Partner> {
    const now = new Date().toISOString();
    return partnersRepository.insert({
      name: input.name,
      website: input.website,
      logo: logo?.url ?? input.logo,
      logoWidth: logo?.width ?? null,
      logoHeight: logo?.height ?? null,
      active: input.active,
      sort: input.sort,
      createdAt: now,
      updatedAt: now
    });
  }

  public async update(id: number, input: PartnerInput, logo: UploadedImage | null): Promise<Partner> {
    const existing = await this.get(id);
    const nextLogo = logo?.url ?? (input.removeLogo ? '' : input.logo || existing.logo);
    const keptSize = nextLogo === existing.logo;
    const saved = await partnersRepository.replace({
      ...existing,
      name: input.name,
      website: input.website,
      logo: nextLogo,
      logoWidth: logo?.width ?? (keptSize ? existing.logoWidth : null),
      logoHeight: logo?.height ?? (keptSize ? existing.logoHeight : null),
      active: input.active,
      sort: input.sort,
      updatedAt: new Date().toISOString()
    });
    if (existing.logo && existing.logo !== saved.logo && isOwnedUpload(existing.logo)) {
      await mediaRepository.remove(existing.logo);
    }
    return saved;
  }

  public async delete(id: number): Promise<void> {
    const removed = await partnersRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Partner not found.');
    }
    if (removed.logo && isOwnedUpload(removed.logo)) {
      await mediaRepository.remove(removed.logo);
    }
  }
}

export const partnersService = new PartnersService();
