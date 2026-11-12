import type { Request, Response } from 'express';
import { HOME_LIST_MAX, HOME_SECTIONS_MAX, homeSectionKeys, type HomeSectionKey } from '../../domain/models.js';
import { safeParseFields } from '../../middleware/validate.js';
import { homeSectionParamSchema, homeSectionSchemas } from '../../schemas/adminSchemas.js';
import { HOME_SECTION_LABELS, homeService } from '../../services/homeService.js';
import { sectionsService } from '../../services/sectionsService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';

async function formOptions(): Promise<Record<string, unknown>> {
  const sections = await sectionsService.list();
  return { sections: sections.map((section) => ({ id: section.id, title: section.title, path: section.path })), listMax: HOME_LIST_MAX, sectionsMax: HOME_SECTIONS_MAX };
}

function sectionFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const text = (name: string): string => (typeof body[name] === 'string' ? body[name] : '');
  const ids = body.sectionIds;
  return {
    enabled: Boolean(body.enabled),
    title: text('title'),
    intro: text('intro'),
    text: text('text'),
    count: text('count'),
    sectionId: text('sectionId') ? Number(text('sectionId')) : null,
    sectionIds: (Array.isArray(ids) ? ids : typeof ids === 'string' ? [ids] : []).map(Number)
  };
}

export class HomeAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const home = await homeService.get();
    render(res, 'home/list', {
      pageTitle: 'Home Page',
      sections: homeSectionKeys.map((key) => ({ key, label: HOME_SECTION_LABELS[key], enabled: home[key].enabled, title: homeService.sectionTitle(home, key) }))
    });
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const home = await homeService.get();
    render(res, 'home/edit', {
      pageTitle: `Home: ${HOME_SECTION_LABELS[key]}`,
      sectionKey: key,
      sectionLabel: HOME_SECTION_LABELS[key],
      section: home[key],
      ...(await formOptions())
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { key } = params(homeSectionParamSchema, req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(homeSectionSchemas[key], body);
    if (!parsed.ok) {
      await HomeAdminController.renderInvalid(res, key, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      await homeService.updateSection(key, parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await HomeAdminController.renderInvalid(res, key, body, state.message, state.fields);
      return;
    }
    setFlash(req, 'success', `${HOME_SECTION_LABELS[key]} section saved.`);
    res.redirect(`/admin/home/${key}/edit`);
  }

  private static async renderInvalid(res: Response, key: HomeSectionKey, body: Record<string, unknown>, message: string, fields: Record<string, string>): Promise<void> {
    res.status(422);
    render(res, 'home/edit', {
      pageTitle: `Home: ${HOME_SECTION_LABELS[key]}`,
      sectionKey: key,
      sectionLabel: HOME_SECTION_LABELS[key],
      section: sectionFromBody(body),
      ...(await formOptions()),
      error: message,
      errors: fields
    });
  }
}
