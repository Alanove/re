import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

export class JsonFileStore<T> {
  private cache: { value: T; mtimeMs: number } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly schema: z.ZodType<T>,
    private readonly fallback: () => T
  ) {}

  public async read(): Promise<T> {
    const mtimeMs = await this.currentMtime();
    if (mtimeMs === null) {
      return this.fallback();
    }
    if (this.cache && this.cache.mtimeMs === mtimeMs) {
      return structuredClone(this.cache.value);
    }
    const raw = await readFile(this.filePath, 'utf8');
    const parsed = this.schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(`Data file ${path.basename(this.filePath)} is invalid: ${parsed.error.message}`, { cause: parsed.error });
    }
    this.cache = { value: parsed.data, mtimeMs };
    return structuredClone(parsed.data);
  }

  public async write(value: T): Promise<void> {
    const validated = this.schema.parse(value);
    await this.enqueue(async () => {
      await this.persist(validated);
    });
  }

  public async update<R>(mutator: (current: T) => Promise<{ next: T; result: R }> | { next: T; result: R }): Promise<R> {
    return this.enqueue(async () => {
      const current = await this.read();
      const { next, result } = await mutator(current);
      const validated = this.schema.parse(next);
      await this.persist(validated);
      return result;
    });
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async persist(value: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.filePath);
    const mtimeMs = await this.currentMtime();
    this.cache = mtimeMs === null ? null : { value: structuredClone(value), mtimeMs };
  }

  private async currentMtime(): Promise<number | null> {
    try {
      const info = await stat(this.filePath);
      return info.mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
