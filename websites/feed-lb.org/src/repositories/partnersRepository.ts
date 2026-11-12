import { DATA_FILES } from '../config/paths.js';
import { partnersFileSchema, type Partner } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export type NewPartner = Omit<Partner, 'id'>;

export class PartnersRepository {
  private readonly store = new JsonFileStore<Partner[]>(DATA_FILES.partners, partnersFileSchema, () => []);

  public async findAll(): Promise<Partner[]> {
    const partners = await this.store.read();
    return partners.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }

  public async findById(id: number): Promise<Partner | null> {
    const partners = await this.store.read();
    return partners.find((partner) => partner.id === id) ?? null;
  }

  public async insert(partner: NewPartner): Promise<Partner> {
    return this.store.update((partners) => {
      const created: Partner = { ...partner, id: partners.reduce((max, item) => Math.max(max, item.id), 0) + 1 };
      return { next: [...partners, created], result: created };
    });
  }

  public async replace(partner: Partner): Promise<Partner> {
    return this.store.update((partners) => ({
      next: partners.map((item) => (item.id === partner.id ? partner : item)),
      result: partner
    }));
  }

  public async remove(id: number): Promise<Partner | null> {
    return this.store.update((partners) => ({
      next: partners.filter((partner) => partner.id !== id),
      result: partners.find((partner) => partner.id === id) ?? null
    }));
  }
}

export const partnersRepository = new PartnersRepository();
