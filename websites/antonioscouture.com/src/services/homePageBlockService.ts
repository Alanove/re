import { db } from '../config/database';

export type HomeBlockType = 'text' | 'products_list' | 'category_display';

export type ProductsListSource = 'featured' | 'new_arrivals' | 'category';

export type CategoryDisplayMode = 'shop_the_look' | 'video';

export interface TextBlockConfig {
  html: string;
  style?: 'default' | 'la_maison';
}

export interface ProductsListBlockConfig {
  title: string;
  discoverLink: string;
  source: ProductsListSource;
  categoryId?: number | null;
  limit?: number;
}

export interface CategoryDisplayBlockConfig {
  categoryId: number | null;
  displayMode: CategoryDisplayMode;
  introHtml?: string;
  /** @deprecated Video is loaded from the category record */
  videoUrl?: string;
  /** @deprecated Poster is loaded from the category image */
  videoPosterUrl?: string;
}

export type HomeBlockConfig =
  | TextBlockConfig
  | ProductsListBlockConfig
  | CategoryDisplayBlockConfig;

export interface HomePageBlock {
  id: number;
  type: HomeBlockType;
  sortOrder: number;
  isEnabled: boolean;
  config: HomeBlockConfig;
}

export interface ResolvedTextBlock extends HomePageBlock {
  type: 'text';
  config: TextBlockConfig;
}

export interface ResolvedProductsListBlock extends HomePageBlock {
  type: 'products_list';
  config: ProductsListBlockConfig;
  products: any[];
}

export interface ResolvedCategoryDisplayBlock extends HomePageBlock {
  type: 'category_display';
  config: CategoryDisplayBlockConfig;
  category: any | null;
  products: any[];
  videoUrl: string;
  videoPosterUrl: string;
}

export type ResolvedHomeBlock =
  | ResolvedTextBlock
  | ResolvedProductsListBlock
  | ResolvedCategoryDisplayBlock;

interface HomePageBlockRow {
  id: number;
  type: string;
  sort_order: number;
  is_enabled: number | boolean;
  config: string | Record<string, unknown>;
}

function parseConfig(raw: string | Record<string, unknown>): HomeBlockConfig {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as HomeBlockConfig;
    } catch {
      return { html: '' } as TextBlockConfig;
    }
  }
  return raw as unknown as HomeBlockConfig;
}

function mapRow(row: HomePageBlockRow): HomePageBlock {
  return {
    id: row.id,
    type: row.type as HomeBlockType,
    sortOrder: row.sort_order,
    isEnabled: Boolean(row.is_enabled),
    config: parseConfig(row.config)
  };
}

function blockLabel(block: HomePageBlock, categoryName?: string): string {
  switch (block.type) {
    case 'text': {
      const cfg = block.config as TextBlockConfig;
      if (cfg.style === 'la_maison') return 'Text — La Maison';
      return 'Text';
    }
    case 'products_list': {
      const cfg = block.config as ProductsListBlockConfig;
      return `Products — ${cfg.title || 'Untitled'}`;
    }
    case 'category_display': {
      const cfg = block.config as CategoryDisplayBlockConfig;
      const mode =
        cfg.displayMode === 'video' ? 'Video' : 'Shop The Look';
      const name = categoryName || (cfg.categoryId ? `Category #${cfg.categoryId}` : 'No category');
      return `Category — ${name} (${mode})`;
    }
    default:
      return block.type;
  }
}

export class HomePageBlockService {
  private static instance: HomePageBlockService;

  public static getInstance(): HomePageBlockService {
    if (!HomePageBlockService.instance) {
      HomePageBlockService.instance = new HomePageBlockService();
    }
    return HomePageBlockService.instance;
  }

  public async getBlocks(includeDisabled = false): Promise<HomePageBlock[]> {
    const where = includeDisabled ? '' : 'WHERE is_enabled = 1';
    const [rows] = await db.query(
      `SELECT * FROM home_page_blocks ${where} ORDER BY sort_order ASC, id ASC`
    );
    return (rows as HomePageBlockRow[]).map(mapRow);
  }

  public async getBlockById(id: number): Promise<HomePageBlock | null> {
    const [rows] = await db.query(
      `SELECT * FROM home_page_blocks WHERE id = ? LIMIT 1`,
      [id]
    );
    const list = rows as HomePageBlockRow[];
    return list?.length ? mapRow(list[0]) : null;
  }

  public async createBlock(
    type: HomeBlockType,
    config: HomeBlockConfig
  ): Promise<number | null> {
    const [maxRows] = await db.query(
      `SELECT MAX(sort_order) AS maxOrder FROM home_page_blocks`
    );
    const sortOrder = Number((maxRows as { maxOrder: number | null }[])?.[0]?.maxOrder ?? -1) + 1;
    const [result] = await db.execute(
      `INSERT INTO home_page_blocks (type, sort_order, is_enabled, config) VALUES (?, ?, 1, ?)`,
      [type, sortOrder, JSON.stringify(config)]
    );
    return (result as { insertId?: number }).insertId ?? null;
  }

  public async updateBlock(
    id: number,
    config: HomeBlockConfig,
    isEnabled?: boolean
  ): Promise<boolean> {
    if (isEnabled === undefined) {
      const [result] = await db.execute(
        `UPDATE home_page_blocks SET config = ? WHERE id = ?`,
        [JSON.stringify(config), id]
      );
      return (result as { affectedRows?: number }).affectedRows === 1;
    }
    const [result] = await db.execute(
      `UPDATE home_page_blocks SET config = ?, is_enabled = ? WHERE id = ?`,
      [JSON.stringify(config), isEnabled ? 1 : 0, id]
    );
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  public async deleteBlock(id: number): Promise<boolean> {
    const [result] = await db.execute(`DELETE FROM home_page_blocks WHERE id = ?`, [
      id
    ]);
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  public async toggleBlock(id: number, enabled: boolean): Promise<boolean> {
    const [result] = await db.execute(
      `UPDATE home_page_blocks SET is_enabled = ? WHERE id = ?`,
      [enabled ? 1 : 0, id]
    );
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  public async reorderBlocks(orderedIds: number[]): Promise<boolean> {
    if (!orderedIds.length) return true;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < orderedIds.length; i++) {
        await conn.execute(
          `UPDATE home_page_blocks SET sort_order = ? WHERE id = ?`,
          [i, orderedIds[i]]
        );
      }
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      console.error('[homePageBlockService] reorder failed:', e);
      return false;
    } finally {
      conn.release();
    }
  }

  public getBlockLabel(block: HomePageBlock, categoryName?: string): string {
    return blockLabel(block, categoryName);
  }

  public defaultConfigForType(type: HomeBlockType): HomeBlockConfig {
    switch (type) {
      case 'text':
        return { html: '', style: 'default' };
      case 'products_list':
        return {
          title: 'New Arrivals',
          discoverLink: '/shop?new_arrival=true',
          source: 'new_arrivals',
          limit: 4
        };
      case 'category_display':
        return {
          categoryId: null,
          displayMode: 'shop_the_look',
          introHtml: ''
        };
      default:
        return { html: '' };
    }
  }

  public async resolveBlocksForRender(
    blocks: HomePageBlock[]
  ): Promise<ResolvedHomeBlock[]> {
    if (!blocks.length) return [];

    const productService = (await import('./productService')).default;
    const categoryService = (await import('./categoryService')).default;

    const categoryIds = new Set<number>();
    for (const block of blocks) {
      if (block.type === 'products_list') {
        const cfg = block.config as ProductsListBlockConfig;
        if (cfg.source === 'category' && cfg.categoryId) {
          categoryIds.add(cfg.categoryId);
        }
      } else if (block.type === 'category_display') {
        const cfg = block.config as CategoryDisplayBlockConfig;
        if (cfg.categoryId) categoryIds.add(cfg.categoryId);
      }
    }

    const allCategories = await categoryService.getCategoryTree();
    const categoryById = new Map<number, any>();
    const flatten = (cats: any[]) => {
      for (const c of cats) {
        categoryById.set(c.id, c);
        if (c.children?.length) flatten(c.children);
      }
    };
    flatten(allCategories);

    const categoryProductsMap: Record<number, any[]> = {};
    for (const catId of categoryIds) {
      const result = await productService.getProducts({
        is_active: true,
        status: 'published',
        category_id: catId,
        page: 1,
        limit: 12,
        sort_by: 'created_at',
        sort_order: 'DESC'
      });
      const products = result.products || [];
      await productService.attachColorOptionsForListing(products);
      categoryProductsMap[catId] = products;
    }

    const resolved: ResolvedHomeBlock[] = [];

    for (const block of blocks) {
      if (block.type === 'text') {
        resolved.push({
          ...block,
          type: 'text',
          config: block.config as TextBlockConfig
        });
        continue;
      }

      if (block.type === 'products_list') {
        const cfg = block.config as ProductsListBlockConfig;
        const limit = Math.min(Math.max(cfg.limit ?? 4, 1), 12);
        const query: Record<string, unknown> = {
          is_active: true,
          status: 'published',
          page: 1,
          limit,
          sort_by: 'created_at',
          sort_order: 'DESC'
        };
        if (cfg.source === 'featured') {
          query.is_featured = true;
        } else if (cfg.source === 'new_arrivals') {
          query.is_new_arrival = true;
        } else if (cfg.source === 'category' && cfg.categoryId) {
          query.category_id = cfg.categoryId;
        }
        const result = await productService.getProducts(query as any);
        const products = result.products || [];
        await productService.attachColorOptionsForListing(products);
        resolved.push({
          ...block,
          type: 'products_list',
          config: cfg,
          products
        });
        continue;
      }

      if (block.type === 'category_display') {
        const cfg = block.config as CategoryDisplayBlockConfig;
        const category = cfg.categoryId
          ? categoryById.get(cfg.categoryId) ?? null
          : null;
        const products = cfg.categoryId
          ? categoryProductsMap[cfg.categoryId] || []
          : [];

        let videoUrl = '';
        let videoPosterUrl = '';
        if (cfg.categoryId && cfg.displayMode === 'video') {
          const media = await categoryService.resolveCategoryHeroMedia(cfg.categoryId);
          videoUrl = media.video_url?.trim() || '';
          videoPosterUrl = media.poster_image_url?.trim() || '';
        }

        resolved.push({
          ...block,
          type: 'category_display',
          config: cfg,
          category,
          products,
          videoUrl,
          videoPosterUrl
        });
      }
    }

    return resolved;
  }
}

export default HomePageBlockService;
