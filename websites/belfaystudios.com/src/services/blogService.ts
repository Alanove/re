import { pagesService, type PageNode } from './pagesService.js';
import { excerpt, toPlainText } from './sanitizeService.js';

export const BLOG_PAGE_SIZE = 9;
const WORDS_PER_MINUTE = 200;

export interface PostCard {
  id: number;
  title: string;
  url: string;
  summary: string;
  image: string;
  publishedAt: string;
  readingMinutes: number;
}

export interface BlogListing {
  root: PageNode;
  posts: PostCard[];
  page: number;
  totalPages: number;
  total: number;
}

function flatten(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function newestFirst(a: PageNode, b: PageNode): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
}

export function toPostCard(page: PageNode): PostCard {
  const words = toPlainText(page.content).split(/\s+/).filter(Boolean).length;
  return {
    id: page.id,
    title: page.title,
    url: page.url,
    summary: page.summary || excerpt(page.content, 200),
    image: page.heroImage,
    publishedAt: page.createdAt,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  };
}

export class BlogService {
  public async findRoot(): Promise<PageNode | null> {
    return flatten(await pagesService.getPublishedTree()).find((node) => node.kind === 'blog') ?? null;
  }

  public isPostOf(root: PageNode, page: PageNode): boolean {
    return page.parentId === root.id;
  }

  public listing(root: PageNode, requestedPage: number): BlogListing | null {
    const sorted = [...root.children].sort(newestFirst);
    const totalPages = Math.max(1, Math.ceil(sorted.length / BLOG_PAGE_SIZE));
    if (requestedPage > totalPages) {
      return null;
    }
    const start = (requestedPage - 1) * BLOG_PAGE_SIZE;
    return {
      root,
      posts: sorted.slice(start, start + BLOG_PAGE_SIZE).map(toPostCard),
      page: requestedPage,
      totalPages,
      total: sorted.length
    };
  }

  public async latest(limit: number): Promise<{ root: PageNode | null; posts: PostCard[] }> {
    const root = await this.findRoot();
    if (!root) {
      return { root: null, posts: [] };
    }
    return { root, posts: [...root.children].sort(newestFirst).slice(0, limit).map(toPostCard) };
  }

  public neighbours(root: PageNode, post: PageNode): { newer: PostCard | null; older: PostCard | null; related: PostCard[] } {
    const sorted = [...root.children].sort(newestFirst);
    const index = sorted.findIndex((node) => node.id === post.id);
    const newer = index > 0 ? sorted[index - 1] : undefined;
    const older = index >= 0 ? sorted[index + 1] : undefined;
    return {
      newer: newer ? toPostCard(newer) : null,
      older: older ? toPostCard(older) : null,
      related: sorted.filter((node) => node.id !== post.id).slice(0, 3).map(toPostCard)
    };
  }
}

export const blogService = new BlogService();
