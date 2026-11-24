import type { Menu, MenuItem } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/httpError.js';
import { menusRepository } from '../repositories/menusRepository.js';
import { pagesService, type PageNode } from './pagesService.js';

export interface ResolvedMenuItem {
  id: string;
  title: string;
  url: string;
  htmlContent: string;
  active: boolean;
  current: boolean;
  children: ResolvedMenuItem[];
}

function collectIds(items: MenuItem[], ids: string[]): string[] {
  for (const item of items) {
    ids.push(item.id);
    collectIds(item.children, ids);
  }
  return ids;
}

function maxDepth(items: MenuItem[]): number {
  return items.reduce((depth, item) => Math.max(depth, 1 + maxDepth(item.children)), 0);
}

export class MenuService {
  public async listMenus(): Promise<Menu[]> {
    return menusRepository.findAll();
  }

  public async getMenu(id: string): Promise<Menu> {
    const menu = await menusRepository.findById(id);
    if (!menu) {
      throw new NotFoundError('Menu not found.');
    }
    return menu;
  }

  public async resolve(id: string, currentPath: string): Promise<ResolvedMenuItem[]> {
    const menu = await menusRepository.findById(id);
    if (!menu) {
      return [];
    }
    const published = await pagesService.getPublishedTree();
    const pagesById = new Map<number, PageNode>();
    const walk = (nodes: PageNode[]): void => {
      for (const node of nodes) {
        pagesById.set(node.id, node);
        walk(node.children);
      }
    };
    walk(published);

    const normalizedCurrent = currentPath.replace(/\/+$/, '') || '/';
    // Match live LiteWeb menu: parents link to the first leaf descendant; nested menus stay hidden.
    const build = (items: MenuItem[]): ResolvedMenuItem[] =>
      [...items]
        .filter((item) => item.active)
        .sort((a, b) => a.sort - b.sort)
        .flatMap((item) => {
          let sectionUrl = item.url;
          if (item.pageId !== null) {
            const page = pagesById.get(item.pageId);
            if (!page) {
              return [];
            }
            sectionUrl = page.url;
          }
          const children = build(item.children);
          const href = children.length > 0 ? children[0]!.url : sectionUrl;
          const isCurrent = sectionUrl === normalizedCurrent || href === normalizedCurrent;
          const isAncestor =
            sectionUrl !== '/' && !sectionUrl.startsWith('#') && normalizedCurrent.startsWith(`${sectionUrl}/`);
          return [
            {
              id: item.id,
              title: item.title,
              url: href,
              htmlContent: item.htmlContent || '',
              active: isCurrent || isAncestor || children.some((child) => child.active),
              current: isCurrent && children.length === 0,
              children
            }
          ];
        });
    return build(menu.items);
  }

  public async create(input: { id: string; name: string; description: string }): Promise<Menu> {
    if (await menusRepository.findById(input.id)) {
      throw new ConflictError('Please correct the highlighted fields.', { id: 'A menu with this id already exists' });
    }
    return menusRepository.save({ id: input.id, name: input.name, description: input.description, items: [] });
  }

  public async update(id: string, input: { name: string; description: string; items: MenuItem[] }): Promise<Menu> {
    const existing = await this.getMenu(id);
    const ids = collectIds(input.items, []);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestError('Each menu item needs a unique id.');
    }
    if (maxDepth(input.items) > 3) {
      throw new BadRequestError('Menus support at most three levels.');
    }
    const flatPages = await pagesService.getFlatList();
    const pageIds = new Set(flatPages.map((page) => page.id));
    const invalidPage = ids.length > 0 && this.findInvalidPage(input.items, pageIds);
    if (invalidPage) {
      throw new BadRequestError(`Menu item "${invalidPage}" links to a page that does not exist.`);
    }
    return menusRepository.save({ ...existing, name: input.name, description: input.description, items: input.items });
  }

  public async delete(id: string): Promise<void> {
    if (id === 'main' || id === 'footer') {
      throw new ConflictError('The main and footer menus are used by the site layout and cannot be deleted.');
    }
    const removed = await menusRepository.remove(id);
    if (!removed) {
      throw new NotFoundError('Menu not found.');
    }
  }

  private findInvalidPage(items: MenuItem[], pageIds: Set<number>): string | null {
    for (const item of items) {
      if (item.pageId !== null && !pageIds.has(item.pageId)) {
        return item.title;
      }
      const nested = this.findInvalidPage(item.children, pageIds);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
}

export const menuService = new MenuService();
