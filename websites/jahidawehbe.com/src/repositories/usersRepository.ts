import { DATA_FILES } from '../config/paths.js';
import { usersFileSchema, type User } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class UsersRepository {
  private readonly store = new JsonFileStore<User[]>(DATA_FILES.users, usersFileSchema, () => []);

  public async findAll(): Promise<User[]> {
    return this.store.read();
  }

  public async findById(id: number): Promise<User | null> {
    const users = await this.store.read();
    return users.find((user) => user.id === id) ?? null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.store.read();
    return users.find((user) => user.email.toLowerCase() === normalized) ?? null;
  }

  public async insert(user: Omit<User, 'id'>): Promise<User> {
    return this.store.update((users) => {
      const id = users.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const created: User = { ...user, id };
      return { next: [...users, created], result: created };
    });
  }

  public async replace(user: User): Promise<User> {
    return this.store.update((users) => {
      const index = users.findIndex((item) => item.id === user.id);
      if (index === -1) {
        throw new Error(`User ${user.id} does not exist`);
      }
      const next = [...users];
      next[index] = user;
      return { next, result: user };
    });
  }

  public async remove(id: number): Promise<boolean> {
    return this.store.update((users) => {
      const next = users.filter((user) => user.id !== id);
      return { next, result: next.length !== users.length };
    });
  }
}

export const usersRepository = new UsersRepository();
