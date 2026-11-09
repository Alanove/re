import { DATA_FILES } from '../config/paths.js';
import { submissionsFileSchema, type Submission } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class SubmissionsRepository {
  private readonly store = new JsonFileStore<Submission[]>(DATA_FILES.submissions, submissionsFileSchema, () => []);

  public async findAll(): Promise<Submission[]> {
    const submissions = await this.store.read();
    return submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async findById(id: string): Promise<Submission | null> {
    const submissions = await this.store.read();
    return submissions.find((submission) => submission.id === id) ?? null;
  }

  public async insert(submission: Submission): Promise<Submission> {
    return this.store.update((submissions) => ({ next: [...submissions, submission], result: submission }));
  }

  public async patch(id: string, changes: Partial<Pick<Submission, 'emailed' | 'read'>>): Promise<Submission | null> {
    return this.store.update((submissions) => {
      let updated: Submission | null = null;
      const next = submissions.map((submission) => {
        if (submission.id !== id) {
          return submission;
        }
        updated = { ...submission, ...changes };
        return updated;
      });
      return { next, result: updated };
    });
  }

  public async remove(id: string): Promise<boolean> {
    return this.store.update((submissions) => {
      const next = submissions.filter((submission) => submission.id !== id);
      return { next, result: next.length !== submissions.length };
    });
  }
}

export const submissionsRepository = new SubmissionsRepository();
