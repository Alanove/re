import { DATA_FILES } from '../config/paths.js';
import { subscribersFileSchema, type Subscriber } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class SubscribersRepository {
  private readonly store = new JsonFileStore<Subscriber[]>(DATA_FILES.subscribers, subscribersFileSchema, () => []);

  public async findAll(): Promise<Subscriber[]> {
    const subscribers = await this.store.read();
    return subscribers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Adds the address unless it is already subscribed; returns false for a duplicate. */
  public async add(subscriber: Subscriber): Promise<boolean> {
    return this.store.update((subscribers) => {
      if (subscribers.some((entry) => entry.email.toLowerCase() === subscriber.email.toLowerCase())) {
        return { next: subscribers, result: false };
      }
      return { next: [...subscribers, subscriber], result: true };
    });
  }

  public async remove(id: string): Promise<boolean> {
    return this.store.update((subscribers) => {
      const next = subscribers.filter((entry) => entry.id !== id);
      return { next, result: next.length !== subscribers.length };
    });
  }
}

export const subscribersRepository = new SubscribersRepository();
