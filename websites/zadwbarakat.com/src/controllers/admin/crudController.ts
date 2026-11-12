import type { Request, Response } from 'express';
import type { z } from 'zod';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema } from '../../schemas/adminSchemas.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

export interface CrudModule<Schema extends z.ZodType, Uploads> {
  /** Admin URL prefix such as `/admin/books`. */
  basePath: string;
  /** Folder holding `list.ejs` and `edit.ejs`. */
  viewFolder: string;
  plural: string;
  singular: string;
  schema: Schema;
  blank: () => Record<string, unknown>;
  /** Extra locals for the edit form (select options and so on). */
  formOptions?: () => Promise<Record<string, unknown>>;
  listLocals: (req: Request) => Promise<Record<string, unknown>>;
  getById: (id: number) => Promise<Record<string, unknown> & { id: number }>;
  /** Saves uploaded files before the record is written; `discard` removes them again if the save fails. */
  saveUploads: (req: Request) => Promise<Uploads>;
  discard: (uploads: Uploads) => Promise<void>;
  create: (input: z.infer<Schema>, uploads: Uploads) => Promise<{ id: number; title: string }>;
  update: (id: number, input: z.infer<Schema>, uploads: Uploads) => Promise<{ id: number; title: string }>;
  remove: (id: number) => Promise<void>;
}

const INVALID = 'Please correct the highlighted fields.';

/** Re-fills a rejected form with what the editor typed, on top of the stored record. */
function valuesFromBody(body: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && key !== '_csrf') {
      values[key] = value;
    }
  }
  values.status = body.published ? 'published' : 'draft';
  values.active = Boolean(body.active);
  return values;
}

/** Standard list / create / edit / delete handlers shared by the content modules. */
export function crudController<Schema extends z.ZodType, Uploads>(module: CrudModule<Schema, Uploads>) {
  const renderForm = async (res: Response, locals: { item: Record<string, unknown>; isCreate: boolean; error?: string; errors?: Record<string, string> }): Promise<void> => {
    const options = module.formOptions ? await module.formOptions() : {};
    const title = typeof locals.item.title === 'string' ? locals.item.title : '';
    render(res, `${module.viewFolder}/edit`, {
      pageTitle: locals.isCreate ? `Add ${module.singular}` : `Edit: ${title}`,
      basePath: module.basePath,
      plural: module.plural,
      singular: module.singular,
      ...options,
      item: locals.item,
      isCreate: locals.isCreate,
      error: locals.error ?? null,
      errors: locals.errors ?? {},
      includeCustomEditor: true
    });
  };

  const save = async (req: Request, res: Response, id: number | null): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const base = id === null ? module.blank() : await module.getById(id);
    const parsed = safeParseFields(module.schema, body);
    if (!parsed.ok) {
      res.status(422);
      await renderForm(res, { item: valuesFromBody(body, base), isCreate: id === null, error: INVALID, errors: parsed.fields });
      return;
    }
    const uploads = await module.saveUploads(req);
    try {
      const saved = id === null ? await module.create(parsed.data, uploads) : await module.update(id, parsed.data, uploads);
      setFlash(req, 'success', `${module.singular[0]?.toUpperCase() ?? ''}${module.singular.slice(1)} "${saved.title}" was saved.`);
      res.redirect(`${module.basePath}/${saved.id}/edit`);
    } catch (error) {
      await module.discard(uploads);
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      res.status(422);
      await renderForm(res, { item: valuesFromBody(body, base), isCreate: id === null, error: state.message, errors: state.fields });
    }
  };

  return {
    list: async (req: Request, res: Response): Promise<void> => {
      render(res, `${module.viewFolder}/list`, {
        pageTitle: module.plural,
        basePath: module.basePath,
        plural: module.plural,
        singular: module.singular,
        ...(await module.listLocals(req))
      });
    },
    createForm: async (_req: Request, res: Response): Promise<void> => {
      await renderForm(res, { item: module.blank(), isCreate: true });
    },
    create: async (req: Request, res: Response): Promise<void> => {
      await save(req, res, null);
    },
    editForm: async (req: Request, res: Response): Promise<void> => {
      const { id } = params(idParamSchema, req);
      await renderForm(res, { item: await module.getById(id), isCreate: false });
    },
    update: async (req: Request, res: Response): Promise<void> => {
      const { id } = params(idParamSchema, req);
      await save(req, res, id);
    },
    remove: async (req: Request, res: Response): Promise<void> => {
      const { id } = params(idParamSchema, req);
      await module.remove(id);
      res.json({ success: true, message: `${module.singular[0]?.toUpperCase() ?? ''}${module.singular.slice(1)} deleted.` });
    }
  };
}
