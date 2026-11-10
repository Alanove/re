import type { Request, Response } from 'express';
import { safeParseFields } from '../../middleware/validate.js';
import { menuCreateSchema, menuFormSchema, stringIdParamSchema } from '../../schemas/adminSchemas.js';
import { menuService } from '../../services/menuService.js';
import { isCollectionKind, pagesService } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

/** Menus link to pages and to the News and Events listings, not to individual stories or events. */
async function pageChoices(): Promise<{ id: number; label: string; url: string }[]> {
  const pages = await pagesService.getFlatList();
  const collectionIds = new Set(pages.filter((page) => isCollectionKind(page.kind)).map((page) => page.id));
  return pages
    .filter((page) => !page.ancestors.some((ancestor) => collectionIds.has(ancestor.id)))
    .map((page) => ({ id: page.id, label: `${'— '.repeat(page.depth)}${page.title}${page.status === 'draft' ? ' (draft)' : ''}`, url: page.url }));
}

export class MenusAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const menus = await menuService.listMenus();
    render(res, 'menus/list', { pageTitle: 'Menus', menus, values: { id: '', name: '', description: '' } });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(menuCreateSchema, body);
    const renderInvalid = async (message: string, fields: Record<string, string>): Promise<void> => {
      res.status(422);
      render(res, 'menus/list', { pageTitle: 'Menus', menus: await menuService.listMenus(), values: body, error: message, errors: fields });
    };
    if (!parsed.ok) {
      await renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      const menu = await menuService.create(parsed.data);
      setFlash(req, 'success', `Menu "${menu.name}" was created.`);
      res.redirect(`/admin/menus/${menu.id}/edit`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await renderInvalid(state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    const menu = await menuService.getMenu(id);
    render(res, 'menus/edit', { pageTitle: `Menu: ${menu.name}`, menu, pages: await pageChoices() });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const menu = await menuService.getMenu(id);
    const parsed = safeParseFields(menuFormSchema, body);
    const renderInvalid = async (message: string, fields: Record<string, string>): Promise<void> => {
      res.status(422);
      render(res, 'menus/edit', {
        pageTitle: `Menu: ${menu.name}`,
        menu: { ...menu, name: typeof body.name === 'string' ? body.name : menu.name, description: typeof body.description === 'string' ? body.description : menu.description },
        pages: await pageChoices(),
        error: message,
        errors: fields
      });
    };
    if (!parsed.ok) {
      await renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      await menuService.update(id, parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await renderInvalid(state.message, state.fields);
      return;
    }
    setFlash(req, 'success', 'Menu saved.');
    res.redirect(`/admin/menus/${id}/edit`);
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const { id } = params(stringIdParamSchema, req);
    await menuService.delete(id);
    res.json({ success: true, message: 'Menu deleted.' });
  }
}
