import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors/httpError.js';
import { safeParseFields } from '../../middleware/validate.js';
import { idParamSchema, pageFormSchema } from '../../schemas/adminSchemas.js';
import { mediaService } from '../../services/mediaService.js';
import { pagesService, type PageNode } from '../../services/pagesService.js';
import { formErrorState, params, render, setFlash } from './helpers.js';
import { blankPage, renderPageForm, saveUploads, uploadedFiles, valuesFromBody, type PageFormMode } from './pageForm.js';

async function requireBlogRoot(): Promise<PageNode> {
  const blogRoot = await pagesService.getBlogRoot();
  if (!blogRoot) {
    throw new NotFoundError('The blog page does not exist.');
  }
  return blogRoot;
}

function blogModeOf(page: PageNode, blogRoot: PageNode): PageFormMode | null {
  if (page.id === blogRoot.id) {
    return 'blogRoot';
  }
  return pagesService.isPost(page, blogRoot) ? 'post' : null;
}

export class BlogAdminController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const [{ root, posts }, imageCounts] = await Promise.all([pagesService.getBlogOverview(), pagesService.getImageCounts()]);
    render(res, 'blog/list', {
      pageTitle: 'Blog',
      blogRoot: root,
      posts: posts.map((post) => ({ ...post, imageCount: imageCounts.get(post.id) ?? 0 }))
    });
  }

  public static async createForm(_req: Request, res: Response): Promise<void> {
    const blogRoot = await requireBlogRoot();
    renderPageForm(res, {
      pageTitle: 'New Blog Post',
      mode: 'post',
      isCreate: true,
      page: blankPage(blogRoot.id),
      gallery: [],
      parents: [],
      blogRoot
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await BlogAdminController.renderInvalid(res, null, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, 'pages');
    try {
      const post = await pagesService.createPost(parsed.data, uploads);
      setFlash(req, 'success', `Post "${post.title}" was created.`);
      res.redirect(`/admin/blog/${post.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await BlogAdminController.renderInvalid(res, null, body, state.message, state.fields);
    }
  }

  public static async editForm(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const [page, blogRoot] = await Promise.all([pagesService.getById(id), requireBlogRoot()]);
    const mode = blogModeOf(page, blogRoot);
    if (!mode) {
      res.redirect(`/admin/pages/${page.id}/edit`);
      return;
    }
    renderPageForm(res, {
      pageTitle: mode === 'blogRoot' ? `Blog page: ${page.title}` : `Edit post: ${page.title}`,
      mode,
      isCreate: false,
      page,
      gallery: await pagesService.getPageImages(id),
      parents: [],
      blogRoot
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = params(idParamSchema, req);
    const [page, blogRoot] = await Promise.all([pagesService.getById(id), requireBlogRoot()]);
    const mode = blogModeOf(page, blogRoot);
    if (!mode) {
      throw new NotFoundError('Post not found.');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = safeParseFields(pageFormSchema, body);
    if (!parsed.ok) {
      await BlogAdminController.renderInvalid(res, id, body, 'Please correct the highlighted fields.', parsed.fields);
      return;
    }
    const uploads = await saveUploads(req, 'pages');
    try {
      const saved = mode === 'blogRoot' ? await pagesService.updatePage(id, parsed.data, uploads) : await pagesService.updatePost(id, parsed.data, uploads);
      setFlash(req, 'success', mode === 'blogRoot' ? 'The blog page was saved.' : `Post "${saved.title}" was saved.`);
      res.redirect(`/admin/blog/${saved.id}/edit`);
    } catch (error) {
      await mediaService.discard(uploadedFiles(uploads));
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      await BlogAdminController.renderInvalid(res, id, body, state.message, state.fields);
    }
  }

  private static async renderInvalid(
    res: Response,
    id: number | null,
    body: Record<string, unknown>,
    message: string,
    fields: Record<string, string>
  ): Promise<void> {
    const blogRoot = await requireBlogRoot();
    const existing = id === null ? null : await pagesService.getById(id);
    const mode: PageFormMode = existing?.id === blogRoot.id ? 'blogRoot' : 'post';
    const base = existing ? { ...existing } : blankPage(blogRoot.id);
    res.status(422);
    renderPageForm(res, {
      pageTitle: existing === null ? 'New Blog Post' : mode === 'blogRoot' ? `Blog page: ${existing.title}` : `Edit post: ${existing.title}`,
      mode,
      isCreate: id === null,
      page: { ...valuesFromBody(body, base), kind: base.kind, parentId: base.parentId },
      gallery: id === null ? [] : await pagesService.getPageImages(id),
      parents: [],
      blogRoot,
      error: message,
      errors: fields
    });
  }
}
