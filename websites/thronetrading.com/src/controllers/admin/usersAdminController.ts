import type { Request, Response } from 'express';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, profileSchema, userCreateSchema, userUpdateSchema } from '../../schemas/adminSchemas.js';
import { usersService } from '../../services/usersService.js';
import { currentUserId, formErrorState, params, render, setFlash } from './helpers.js';

function userFromBody(body: Record<string, unknown>, id: number | null): Record<string, unknown> {
  const text = (key: string): string => (typeof body[key] === 'string' ? body[key] : '');
  return { id, name: text('name'), email: text('email'), role: text('role') || 'editor', active: Boolean(body.active) };
}

export class UsersAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    render(res, 'users/list', { pageTitle: 'Users', users: await usersService.list() });
  }

  public static createForm(_req: Request, res: Response): void {
    render(res, 'users/edit', {
      pageTitle: 'Add User',
      isCreate: true,
      user: { id: null, name: '', email: '', role: 'editor', active: true }
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'users/edit', { pageTitle: 'Add User', isCreate: true, user: userFromBody(body, null), error: message, errors: fields });
    };
    const parsed = safeParseFields(userCreateSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      const user = await usersService.create(parsed.data);
      setFlash(req, 'success', `${user.name} was added.`);
      res.redirect('/admin/users');
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const user = await usersService.get(id);
    render(res, 'users/edit', { pageTitle: `User: ${user.name}`, isCreate: false, user });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'users/edit', { pageTitle: 'Edit User', isCreate: false, user: userFromBody(body, id), error: message, errors: fields });
    };
    const parsed = safeParseFields(userUpdateSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      const user = await usersService.update(id, parsed.data, currentUserId(req));
      setFlash(req, 'success', `${user.name} was saved.`);
      res.redirect('/admin/users');
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
    }
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    await usersService.delete(id, currentUserId(req));
    res.json({ success: true, message: 'User deleted.' });
  }

  public static async profileForm(req: Request, res: Response): Promise<void> {
    const user = await usersService.get(currentUserId(req));
    render(res, 'users/profile', { pageTitle: 'My Profile', user });
  }

  public static async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = currentUserId(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = async (message: string, fields: Record<string, string>): Promise<void> => {
      const user = await usersService.get(userId);
      res.status(422);
      render(res, 'users/profile', {
        pageTitle: 'My Profile',
        user: { ...user, name: typeof body.name === 'string' ? body.name : user.name },
        error: message,
        errors: fields
      });
    };
    const parsed = safeParseFields(profileSchema, body);
    if (!parsed.ok) {
      await renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      await usersService.updateProfile(userId, parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await renderInvalid(state.message, state.fields);
      return;
    }
    setFlash(req, 'success', 'Your profile was saved.');
    res.redirect('/admin/profile');
  }
}
