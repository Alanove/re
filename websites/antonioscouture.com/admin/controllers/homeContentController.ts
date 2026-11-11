import { Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { securityService } from '../../src/services/securityService';
import HomePageContentService, {
  HomePageContent,
  HomeServiceColumn
} from '../../src/services/homePageContentService';
import HomePageBlockService, {
  CategoryDisplayBlockConfig,
  HomeBlockConfig,
  HomeBlockType,
  ProductsListBlockConfig,
  TextBlockConfig
} from '../../src/services/homePageBlockService';
import { getPublicUrl } from '../../src/constants';

const storageService = StorageService.getInstance();
const homePageContentService = HomePageContentService.getInstance();
const homePageBlockService = HomePageBlockService.getInstance();
const mediaUpload = storageService.createHomeContentMediaUploadConfig();

function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (v === undefined || v === null) return '';
  return String(v);
}

function fileFromReq(req: Request, field: string): { path: string } | undefined {
  const files = (req as any).files as Record<string, { path: string }[]> | undefined;
  const list = files?.[field];
  return list?.[0];
}

async function verifyCsrf(req: Request, res: Response): Promise<boolean> {
  const body = req.body as Record<string, unknown>;
  const csrfToken = body._csrf;
  if (!csrfToken) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const originalBody = req.body;
      req.body = { ...originalBody, _csrf: csrfToken };
      securityService.csrfProtection(req, res, (csrfErr: any) => {
        req.body = originalBody;
        if (csrfErr?.code === 'EBADCSRFTOKEN') reject(new Error('csrf'));
        else if (csrfErr) reject(csrfErr);
        else resolve();
      });
    });
    return true;
  } catch {
    return false;
  }
}

function flattenCategories(categories: any[], depth = 0): { id: number; name: string; label: string }[] {
  const out: { id: number; name: string; label: string }[] = [];
  for (const cat of categories) {
    const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';
    out.push({ id: cat.id, name: cat.name, label: `${prefix}${cat.name}` });
    if (cat.children?.length) {
      out.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return out;
}

function serviceColumnsFromBody(body: Record<string, unknown>): HomeServiceColumn[] {
  return [
    {
      title: str(body, 'care_title'),
      bodyHtml: str(body, 'care_body_html'),
      buttonText: str(body, 'care_button_text'),
      buttonLink: str(body, 'care_button_link')
    },
    {
      title: str(body, 'appointments_title'),
      bodyHtml: str(body, 'appointments_body_html'),
      buttonText: str(body, 'appointments_button_text'),
      buttonLink: str(body, 'appointments_button_link')
    },
    {
      title: str(body, 'bridal_title'),
      bodyHtml: str(body, 'bridal_body_html'),
      buttonText: str(body, 'bridal_button_text'),
      buttonLink: str(body, 'bridal_button_link')
    }
  ];
}

export class HomeContentController {
  private static async renderBuilder(
    req: Request,
    res: Response,
    opts: { error?: string; success?: string }
  ): Promise<void> {
    const blocks = await homePageBlockService.getBlocks(true);
    const content = await homePageContentService.getHomePageContent();
    const categoryService = (await import('../../src/services/categoryService')).default;
    const allCategories = await categoryService.getCategoryTree();
    const categories = flattenCategories(allCategories);

    const blocksWithLabels = blocks.map((block) => {
      const catId =
        block.type === 'category_display'
          ? (block.config as CategoryDisplayBlockConfig).categoryId
          : block.type === 'products_list' &&
              (block.config as ProductsListBlockConfig).source === 'category'
            ? (block.config as ProductsListBlockConfig).categoryId
            : null;
      const catName = catId
        ? categories.find((c) => c.id === catId)?.name
        : undefined;
      return {
        ...block,
        label: homePageBlockService.getBlockLabel(block, catName)
      };
    });

    res.render('home-content/edit', {
      title: 'Homepage builder',
      pageTitle: 'Homepage builder',
      pageSubtitle: 'Reorder components, edit content, and manage service boxes above the footer.',
      user: (req as any).user,
      url: req.originalUrl,
      csrfToken: (res.locals as any).csrfToken || '',
      includeCustomEditor: true,
      showBreadcrumb: false,
      blocks: blocksWithLabels,
      categories,
      content,
      error: opts.error,
      success: opts.success,
      includeHomePageBuilder: true,
      pageJS: `
window.HOME_PAGE_BUILDER = {
  csrfToken: ${JSON.stringify((res.locals as any).csrfToken || '')},
  categories: ${JSON.stringify(categories)},
  blocks: ${JSON.stringify(blocksWithLabels)}
};
`
    });
  }

  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const opts: { success?: string; error?: string } = {};
      if (typeof req.query.success === 'string') opts.success = req.query.success;
      if (typeof req.query.error === 'string') opts.error = req.query.error;
      await HomeContentController.renderBuilder(req, res, opts);
    } catch (e) {
      console.error('HomeContentController.index:', e);
      res.status(500).send('Internal Server Error');
    }
  }

  public static async createBlock(req: Request, res: Response): Promise<void> {
    try {
      if (!(await verifyCsrf(req, res))) {
        res.status(403).json({ success: false, message: 'Security validation failed.' });
        return;
      }
      const type = str(req.body as Record<string, unknown>, 'type') as HomeBlockType;
      if (!['text', 'products_list', 'category_display'].includes(type)) {
        res.status(400).json({ success: false, message: 'Invalid block type.' });
        return;
      }
      const config = homePageBlockService.defaultConfigForType(type);
      const id = await homePageBlockService.createBlock(type, config);
      if (!id) {
        res.status(500).json({ success: false, message: 'Could not create block.' });
        return;
      }
      res.json({ success: true, id });
    } catch (e) {
      console.error('HomeContentController.createBlock:', e);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  public static async updateBlock(req: Request, res: Response): Promise<void> {
    mediaUpload.fields([
      { name: 'block_video', maxCount: 1 },
      { name: 'block_video_poster', maxCount: 1 }
    ])(req as any, res as any, async (multerErr: unknown) => {
      if (multerErr) {
        res.status(400).json({
          success: false,
          message: multerErr instanceof Error ? multerErr.message : 'Upload failed.'
        });
        return;
      }

      try {
        if (!(await verifyCsrf(req, res))) {
          res.status(403).json({ success: false, message: 'Security validation failed.' });
          return;
        }

        const blockId = parseInt(String(req.params.id), 10);
        if (!blockId) {
          res.status(400).json({ success: false, message: 'Invalid block id.' });
          return;
        }

        const existing = await homePageBlockService.getBlockById(blockId);
        if (!existing) {
          res.status(404).json({ success: false, message: 'Block not found.' });
          return;
        }

        const body = req.body as Record<string, unknown>;
        let config: HomeBlockConfig;

        if (existing.type === 'text') {
          config = {
            html: str(body, 'html'),
            style: str(body, 'style') === 'la_maison' ? 'la_maison' : 'default'
          } as TextBlockConfig;
        } else if (existing.type === 'products_list') {
          const source = str(body, 'source') as ProductsListBlockConfig['source'];
          const categoryIdRaw = str(body, 'category_id');
          config = {
            title: str(body, 'title'),
            discoverLink: str(body, 'discover_link'),
            source: ['featured', 'new_arrivals', 'category'].includes(source)
              ? source
              : 'new_arrivals',
            categoryId: categoryIdRaw ? parseInt(categoryIdRaw, 10) : null,
            limit: Math.min(Math.max(parseInt(str(body, 'limit') || '4', 10) || 4, 1), 12)
          };
        } else {
          const categoryIdRaw = str(body, 'category_id');
          const displayMode = str(body, 'display_mode');
          config = {
            categoryId: categoryIdRaw ? parseInt(categoryIdRaw, 10) : null,
            displayMode: displayMode === 'video' ? 'video' : 'shop_the_look',
            introHtml: str(body, 'intro_html')
          };
        }

        const isEnabled = str(body, 'is_enabled') !== '0';
        const ok = await homePageBlockService.updateBlock(blockId, config, isEnabled);
        res.json({
          success: ok,
          message: ok ? 'Block saved.' : 'Could not save block.'
        });
      } catch (e) {
        console.error('HomeContentController.updateBlock:', e);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
    });
  }

  public static async deleteBlock(req: Request, res: Response): Promise<void> {
    try {
      if (!(await verifyCsrf(req, res))) {
        res.status(403).json({ success: false, message: 'Security validation failed.' });
        return;
      }
      const blockId = parseInt(String(req.params.id), 10);
      const ok = await homePageBlockService.deleteBlock(blockId);
      res.json({ success: ok, message: ok ? 'Block deleted.' : 'Could not delete block.' });
    } catch (e) {
      console.error('HomeContentController.deleteBlock:', e);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  public static async reorderBlocks(req: Request, res: Response): Promise<void> {
    try {
      if (!(await verifyCsrf(req, res))) {
        res.status(403).json({ success: false, message: 'Security validation failed.' });
        return;
      }
      const body = req.body as { orderedIds?: number[] | string };
      let orderedIds: number[] = [];
      if (Array.isArray(body.orderedIds)) {
        orderedIds = body.orderedIds.map((id) => parseInt(String(id), 10)).filter(Boolean);
      } else if (typeof body.orderedIds === 'string') {
        try {
          orderedIds = JSON.parse(body.orderedIds);
        } catch {
          orderedIds = [];
        }
      }
      const ok = await homePageBlockService.reorderBlocks(orderedIds);
      res.json({ success: ok, message: ok ? 'Order saved.' : 'Could not reorder blocks.' });
    } catch (e) {
      console.error('HomeContentController.reorderBlocks:', e);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }

  public static async updateServiceColumns(req: Request, res: Response): Promise<void> {
    try {
      if (!(await verifyCsrf(req, res))) {
        res.redirect('/admin/home-content?error=' + encodeURIComponent('Security validation failed.'));
        return;
      }
      const columns = serviceColumnsFromBody(req.body as Record<string, unknown>);
      const ok = await homePageContentService.saveServiceColumns(columns);
      if (ok) {
        res.redirect(
          '/admin/home-content?success=' + encodeURIComponent('Service boxes saved.')
        );
        return;
      }
      res.redirect(
        '/admin/home-content?error=' +
          encodeURIComponent('Could not save service boxes.')
      );
    } catch (e) {
      console.error('HomeContentController.updateServiceColumns:', e);
      res.status(500).send('Internal Server Error');
    }
  }

  /** @deprecated Legacy single-form update — redirects to builder */
  public static async update(req: Request, res: Response): Promise<void> {
    await HomeContentController.updateServiceColumns(req, res);
  }
}
