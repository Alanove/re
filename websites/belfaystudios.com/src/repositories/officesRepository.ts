import { DATA_FILES } from '../config/paths.js';
import { officesFileSchema, type Office } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class OfficesRepository {
  private readonly store = new JsonFileStore<Office[]>(DATA_FILES.offices, officesFileSchema, () => []);

  public async findAll(): Promise<Office[]> {
    const offices = await this.store.read();
    return offices.sort((a, b) => a.sort - b.sort || a.country.localeCompare(b.country));
  }

  public async findById(id: string): Promise<Office | null> {
    const offices = await this.store.read();
    return offices.find((office) => office.id === id) ?? null;
  }

  public async save(office: Office, previousId: string | null): Promise<Office> {
    return this.store.update((offices) => {
      const matchId = previousId ?? office.id;
      let next = offices.filter((item) => item.id !== matchId);
      if (office.isPrimary) {
        next = next.map((item) => ({ ...item, isPrimary: false }));
      }
      next.push(office);
      return { next, result: office };
    });
  }

  public async remove(id: string): Promise<boolean> {
    return this.store.update((offices) => {
      const next = offices.filter((office) => office.id !== id);
      return { next, result: next.length !== offices.length };
    });
  }
}

export const officesRepository = new OfficesRepository();
