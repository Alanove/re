import type { Request, Response } from 'express';
import { safeParseFields } from '../../middleware/validate.js';
import { videoAddFormSchema, videoChannelFormSchema, videoLibraryFormSchema } from '../../schemas/adminSchemas.js';
import { pagesService } from '../../services/pagesService.js';
import { videoService } from '../../services/videoService.js';
import { formErrorState, render, setFlash, toRawRowFields } from './helpers.js';

type VideoForm = 'channel' | 'add' | 'library';

interface InvalidState {
  form: VideoForm;
  message: string;
  fields: Record<string, string>;
  body: Record<string, unknown>;
}

export class VideosAdminController {
  public static async index(_req: Request, res: Response): Promise<void> {
    await VideosAdminController.renderPage(res, null);
  }

  public static async updateChannel(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(videoChannelFormSchema, body);
    if (!parsed.ok) {
      await VideosAdminController.renderPage(res, { form: 'channel', message: 'Please correct the highlighted fields.', fields: parsed.fields, body });
      return;
    }
    try {
      const library = await videoService.updateChannel(parsed.data);
      if (library.channelId && library.sync.enabled) {
        const result = await videoService.syncNow();
        setFlash(req, result.ok ? 'success' : 'warning', `Channel saved. ${result.message}`);
      } else {
        setFlash(req, 'success', library.channelId ? 'Channel saved. Automatic sync is paused.' : 'Channel removed. Only the videos you add by hand are shown.');
      }
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await VideosAdminController.renderPage(res, { form: 'channel', ...state, body });
      return;
    }
    res.redirect('/admin/videos');
  }

  public static async sync(req: Request, res: Response): Promise<void> {
    const result = await videoService.syncNow();
    setFlash(req, result.ok ? 'success' : 'danger', result.message);
    res.redirect('/admin/videos');
  }

  public static async add(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(videoAddFormSchema, body);
    if (!parsed.ok) {
      await VideosAdminController.renderPage(res, { form: 'add', message: 'Please correct the highlighted fields.', fields: parsed.fields, body });
      return;
    }
    try {
      const video = await videoService.addVideo(parsed.data);
      setFlash(req, 'success', `"${video.title}" was added to the library.`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await VideosAdminController.renderPage(res, { form: 'add', ...state, body });
      return;
    }
    res.redirect('/admin/videos');
  }

  public static async updateLibrary(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(videoLibraryFormSchema, body);
    if (!parsed.ok) {
      await VideosAdminController.renderPage(res, {
        form: 'library',
        message: 'Please correct the highlighted fields.',
        fields: toRawRowFields(body.items, 'items', parsed.fields),
        body
      });
      return;
    }
    try {
      await videoService.updateLibrary(parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await VideosAdminController.renderPage(res, { form: 'library', ...state, body });
      return;
    }
    setFlash(req, 'success', 'Video library saved.');
    res.redirect('/admin/videos');
  }

  private static async renderPage(res: Response, invalid: InvalidState | null): Promise<void> {
    const [library, status, videosPage] = await Promise.all([videoService.getLibrary(), videoService.status(), pagesService.findPublishedByKind('videos')]);
    const text = (key: string): string => (invalid && typeof invalid.body[key] === 'string' ? invalid.body[key] : '');
    if (invalid) {
      res.status(422);
    }
    const libraryRows = invalid?.form === 'library' ? VideosAdminController.rowsFromBody(invalid.body.items) : null;
    render(res, 'videos/index', {
      pageTitle: 'Videos',
      library,
      status,
      videosPageUrl: videosPage?.url ?? null,
      items: library.items.map((item) => {
        const row = libraryRows?.get(item.id);
        return row
          ? { ...item, title: row.title, sort: row.sort, hidden: row.hidden, remove: row.remove, pinned: text('featured') === item.id }
          : { ...item, remove: false };
      }),
      channelValues: invalid?.form === 'channel' ? { channel: text('channel'), syncEnabled: Boolean(invalid.body.syncEnabled) } : { channel: library.channelId, syncEnabled: library.sync.enabled },
      addValues: invalid?.form === 'add' ? { url: text('url'), title: text('title') } : { url: '', title: '' },
      invalidForm: invalid?.form ?? null,
      error: invalid?.message ?? null,
      errors: invalid?.fields ?? {}
    });
  }

  private static rowsFromBody(value: unknown): Map<string, { title: string; sort: string; hidden: boolean; remove: boolean }> {
    const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
    const map = new Map<string, { title: string; sort: string; hidden: boolean; remove: boolean }>();
    for (const raw of rows) {
      const row = (raw ?? {}) as Record<string, unknown>;
      if (typeof row.id === 'string') {
        map.set(row.id, {
          title: typeof row.title === 'string' ? row.title : '',
          sort: typeof row.sort === 'string' ? row.sort : '0',
          hidden: Boolean(row.hidden),
          remove: Boolean(row.remove)
        });
      }
    }
    return map;
  }
}
