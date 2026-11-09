import type { z } from 'zod';
import type { Office } from '../domain/models.js';
import { ConflictError, NotFoundError } from '../errors/httpError.js';
import { officesRepository } from '../repositories/officesRepository.js';
import type { officeFormSchema } from '../schemas/adminSchemas.js';

type OfficeInput = z.infer<typeof officeFormSchema>;

export class OfficesService {
  public async list(): Promise<Office[]> {
    return officesRepository.findAll();
  }

  public async getPrimary(): Promise<Office | null> {
    const offices = await officesRepository.findAll();
    return offices.find((office) => office.isPrimary) ?? offices[0] ?? null;
  }

  public async get(id: string): Promise<Office> {
    const office = await officesRepository.findById(id);
    if (!office) {
      throw new NotFoundError('Office not found.');
    }
    return office;
  }

  public async save(input: OfficeInput, previousId: string | null): Promise<Office> {
    if (previousId !== null) {
      await this.get(previousId);
    }
    if (input.id !== previousId && (await officesRepository.findById(input.id))) {
      throw new ConflictError('Please correct the highlighted fields.', { id: 'Another office already uses this id' });
    }
    return officesRepository.save(
      {
        id: input.id,
        country: input.country,
        role: input.role,
        address: input.address,
        poBox: input.poBox,
        phones: input.phones,
        fax: input.fax,
        emails: input.emails,
        mapQuery: input.mapQuery,
        isPrimary: input.isPrimary,
        sort: input.sort
      },
      previousId
    );
  }

  public async delete(id: string): Promise<void> {
    if (!(await officesRepository.remove(id))) {
      throw new NotFoundError('Office not found.');
    }
  }
}

export const officesService = new OfficesService();
