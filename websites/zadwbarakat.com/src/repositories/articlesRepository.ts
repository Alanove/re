import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ARTICLES_DIR } from '../config/paths.js';
import { articleSchema, type Article } from '../domain/models.js';

/**
 * Articles are stored one per file (`data/articles/<id>.json`) and held in memory after the first read.
 * Every write goes through one queue, so ids stay unique and the cache matches the disk.
 */
export class ArticlesRepository {
  private cache: Map<number, Article> | null = null;
  private loading: Promise<Map<number, Article>> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private version = 0;

  /** Changes whenever an article is written, so callers can rebuild derived indexes lazily. */
  public get revision(): number {
    return this.version;
  }

  public async findAll(): Promise<Article[]> {
    const all = await this.load();
    return [...all.values()].map((article) => structuredClone(article));
  }

  /** Read-only view for hot paths (listing, search); callers must not mutate the returned objects. */
  public async snapshot(): Promise<readonly Article[]> {
    const all = await this.load();
    return [...all.values()];
  }

  public async findById(id: number): Promise<Article | null> {
    const article = (await this.load()).get(id);
    return article ? structuredClone(article) : null;
  }

  public async insert(article: Omit<Article, 'id'>): Promise<Article> {
    return this.enqueue(async () => {
      const all = await this.load();
      const id = [...all.keys()].reduce((max, value) => Math.max(max, value), 0) + 1;
      const created = articleSchema.parse({ ...article, id });
      await this.persist(created);
      all.set(id, created);
      this.version += 1;
      return structuredClone(created);
    });
  }

  public async replace(article: Article): Promise<Article> {
    return this.enqueue(async () => {
      const all = await this.load();
      if (!all.has(article.id)) {
        throw new Error(`Article ${article.id} does not exist`);
      }
      const validated = articleSchema.parse(article);
      await this.persist(validated);
      all.set(validated.id, validated);
      this.version += 1;
      return structuredClone(validated);
    });
  }

  public async remove(id: number): Promise<Article | null> {
    return this.enqueue(async () => {
      const all = await this.load();
      const existing = all.get(id) ?? null;
      if (!existing) {
        return null;
      }
      try {
        await unlink(this.filePath(id));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      all.delete(id);
      this.version += 1;
      return existing;
    });
  }

  /** Import only: replaces the whole folder with the given articles. */
  public async replaceAll(articles: Article[]): Promise<void> {
    await this.enqueue(async () => {
      await mkdir(ARTICLES_DIR, { recursive: true });
      const keep = new Set(articles.map((article) => `${article.id}.json`));
      for (const name of await readdir(ARTICLES_DIR)) {
        if (name.endsWith('.json') && !keep.has(name)) {
          await unlink(path.join(ARTICLES_DIR, name));
        }
      }
      const next = new Map<number, Article>();
      for (const article of articles) {
        const validated = articleSchema.parse(article);
        await this.persist(validated);
        next.set(validated.id, validated);
      }
      this.cache = next;
      this.version += 1;
    });
  }

  private filePath(id: number): string {
    return path.join(ARTICLES_DIR, `${id}.json`);
  }

  private async persist(article: Article): Promise<void> {
    await mkdir(ARTICLES_DIR, { recursive: true });
    const target = this.filePath(article.id);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
    await rename(temp, target);
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private load(): Promise<Map<number, Article>> {
    if (this.cache) {
      return Promise.resolve(this.cache);
    }
    this.loading ??= this.readAll().then((map) => {
      this.cache = map;
      this.loading = null;
      return map;
    });
    return this.loading;
  }

  private async readAll(): Promise<Map<number, Article>> {
    const map = new Map<number, Article>();
    let names: string[];
    try {
      names = await readdir(ARTICLES_DIR);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return map;
      }
      throw error;
    }
    for (const name of names.filter((entry) => /^\d+\.json$/.test(entry))) {
      const raw = await readFile(path.join(ARTICLES_DIR, name), 'utf8');
      const parsed = articleSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new Error(`Article file ${name} is invalid: ${parsed.error.message}`, { cause: parsed.error });
      }
      map.set(parsed.data.id, parsed.data);
    }
    return map;
  }
}

export const articlesRepository = new ArticlesRepository();
