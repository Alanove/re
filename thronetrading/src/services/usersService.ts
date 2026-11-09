import type { z } from 'zod';
import type { PublicUser, User, UserRole } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../errors/httpError.js';
import { usersRepository } from '../repositories/usersRepository.js';
import type { profileSchema, userCreateSchema, userUpdateSchema } from '../schemas/adminSchemas.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './passwordService.js';

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export class UsersService {
  public async list(): Promise<PublicUser[]> {
    const users = await usersRepository.findAll();
    return users.map(toPublicUser).sort((a, b) => a.name.localeCompare(b.name));
  }

  public async get(id: number): Promise<PublicUser> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return toPublicUser(user);
  }

  public async authenticate(email: string, password: string): Promise<PublicUser> {
    const user = await usersRepository.findByEmail(email);
    if (!user || !user.active) {
      await burnPasswordCheck(password);
      throw new UnauthorizedError('Invalid email or password.');
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password.');
    }
    const updated = await usersRepository.replace({ ...user, lastLoginAt: new Date().toISOString() });
    return toPublicUser(updated);
  }

  public async findActive(id: number): Promise<PublicUser | null> {
    const user = await usersRepository.findById(id);
    return user && user.active ? toPublicUser(user) : null;
  }

  public async create(input: z.infer<typeof userCreateSchema>): Promise<PublicUser> {
    if (await usersRepository.findByEmail(input.email)) {
      throw new ConflictError('Please correct the highlighted fields.', { email: 'A user with this email already exists' });
    }
    const now = new Date().toISOString();
    const created = await usersRepository.insert({
      email: input.email,
      name: input.name,
      role: input.role,
      active: input.active,
      passwordHash: await hashPassword(input.password),
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    });
    return toPublicUser(created);
  }

  public async upsertSeedAdmin(email: string, name: string, password: string): Promise<{ user: PublicUser; created: boolean }> {
    const existing = await usersRepository.findByEmail(email);
    const now = new Date().toISOString();
    if (existing) {
      const updated = await usersRepository.replace({
        ...existing,
        name,
        role: 'admin',
        active: true,
        passwordHash: await hashPassword(password),
        updatedAt: now
      });
      return { user: toPublicUser(updated), created: false };
    }
    const created = await usersRepository.insert({
      email: email.toLowerCase(),
      name,
      role: 'admin',
      active: true,
      passwordHash: await hashPassword(password),
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    });
    return { user: toPublicUser(created), created: true };
  }

  public async update(id: number, input: z.infer<typeof userUpdateSchema>, actorId: number): Promise<PublicUser> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    const other = await usersRepository.findByEmail(input.email);
    if (other && other.id !== id) {
      throw new ConflictError('Please correct the highlighted fields.', { email: 'A user with this email already exists' });
    }
    if (id === actorId && (!input.active || input.role !== 'admin')) {
      throw new BadRequestError('You cannot deactivate or demote your own account.');
    }
    await this.assertAdminRemains(id, input.role, input.active);
    const updated = await usersRepository.replace({
      ...user,
      name: input.name,
      email: input.email,
      role: input.role,
      active: input.active,
      passwordHash: input.password ? await hashPassword(input.password) : user.passwordHash,
      updatedAt: new Date().toISOString()
    });
    return toPublicUser(updated);
  }

  public async updateProfile(id: number, input: z.infer<typeof profileSchema>): Promise<PublicUser> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    let passwordHash = user.passwordHash;
    if (input.password) {
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new BadRequestError('Please correct the highlighted fields.', { currentPassword: 'Current password is incorrect' });
      }
      passwordHash = await hashPassword(input.password);
    }
    const updated = await usersRepository.replace({ ...user, name: input.name, passwordHash, updatedAt: new Date().toISOString() });
    return toPublicUser(updated);
  }

  public async delete(id: number, actorId: number): Promise<void> {
    if (id === actorId) {
      throw new BadRequestError('You cannot delete your own account.');
    }
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    await this.assertAdminRemains(id, 'editor', false);
    await usersRepository.remove(id);
  }

  private async assertAdminRemains(changingId: number, nextRole: UserRole, nextActive: boolean): Promise<void> {
    if (nextRole === 'admin' && nextActive) {
      return;
    }
    const users = await usersRepository.findAll();
    const remainingAdmins = users.filter((user) => user.id !== changingId && user.role === 'admin' && user.active);
    if (remainingAdmins.length === 0) {
      throw new BadRequestError('At least one active administrator is required.');
    }
  }
}

export const usersService = new UsersService();
