/* @local/postgres 1.0.0 - generated from packages/postgres, do not edit */
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;

const connectionStringSchema = z.object({
  connectionString: z.string().trim().min(1),
  ssl: z.boolean().optional().default(false),
  max: z.number().int().min(1).max(100).optional().default(10)
});

const hostPartsSchema = z.object({
  host: z.string().trim().min(1),
  port: z.number().int().min(1).max(65535).optional().default(5432),
  user: z.string().trim().min(1),
  password: z.string(),
  database: z.string().trim().min(1),
  ssl: z.boolean().optional().default(false),
  max: z.number().int().min(1).max(100).optional().default(10)
});

export const postgresConfigSchema = z.union([connectionStringSchema, hostPartsSchema]);

export type PostgresConfig = z.infer<typeof postgresConfigSchema>;

export class PostgresError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'PostgresError';
  }
}

export interface QueryResultRow {
  [column: string]: unknown;
}

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export interface Postgres {
  isConfigured(): boolean;
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  check(): Promise<void>;
  close(): Promise<void>;
}

type PoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
  end: () => Promise<void>;
};

export type CreatePostgresOptions = {
  /** Inject a pool for tests. Production callers leave this unset. */
  poolFactory?: (config: PostgresConfig) => PoolLike;
};

function isHalfFilled(raw: Record<string, unknown>): boolean {
  const hasString = typeof raw.connectionString === 'string' && raw.connectionString.trim().length > 0;
  const hostKeys = ['host', 'user', 'password', 'database'] as const;
  const presentHost = hostKeys.filter((key) => {
    const value = raw[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
  if (hasString && presentHost.length > 0) {
    return true;
  }
  if (!hasString && presentHost.length > 0 && presentHost.length < hostKeys.length) {
    return true;
  }
  return false;
}

function buildPoolConfig(config: PostgresConfig): pg.PoolConfig {
  if ('connectionString' in config) {
    return {
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
      max: config.max
    };
  }
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    max: config.max
  };
}

/**
 * Builds a pooled PostgreSQL client from an explicit config object.
 * The package never reads process.env; the app maps its env into this shape.
 */
export function createPostgres(
  rawConfig: PostgresConfig | null | undefined,
  options?: CreatePostgresOptions
): Postgres {
  if (!rawConfig) {
    return {
      isConfigured(): boolean {
        return false;
      },
      query<T extends QueryResultRow = QueryResultRow>(): Promise<QueryResult<T>> {
        return Promise.reject(new PostgresError('Postgres is not configured.'));
      },
      check(): Promise<void> {
        return Promise.reject(new PostgresError('Postgres is not configured.'));
      },
      close(): Promise<void> {
        return Promise.resolve();
      }
    };
  }

  if (isHalfFilled(rawConfig as Record<string, unknown>)) {
    throw new PostgresError(
      'Invalid postgres configuration: use a connectionString or a full host/user/password/database set, not both and not a partial set.'
    );
  }

  let config: PostgresConfig;
  try {
    config = postgresConfigSchema.parse(rawConfig);
  } catch (error) {
    throw new PostgresError('Invalid postgres configuration.', { cause: error });
  }

  const factory =
    options?.poolFactory ??
    ((cfg: PostgresConfig) => new Pool(buildPoolConfig(cfg)) as unknown as PoolLike);

  let pool: PoolLike | null = null;

  function getPool(): PoolLike {
    if (!pool) {
      pool = factory(config);
    }
    return pool;
  }

  return {
    isConfigured(): boolean {
      return true;
    },

    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = []
    ): Promise<QueryResult<T>> {
      const trimmed = String(sql ?? '').trim();
      if (!trimmed) {
        throw new PostgresError('SQL must not be empty.');
      }
      if (!Array.isArray(params)) {
        throw new PostgresError('Query params must be an array.');
      }
      try {
        const result = await getPool().query(trimmed, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? result.rows.length
        };
      } catch (error) {
        if (error instanceof PostgresError) {
          throw error;
        }
        throw new PostgresError('Postgres query failed.', { cause: error });
      }
    },

    async check(): Promise<void> {
      await this.query('SELECT 1');
    },

    async close(): Promise<void> {
      if (!pool) {
        return;
      }
      const current = pool;
      pool = null;
      try {
        await current.end();
      } catch (error) {
        throw new PostgresError('Failed to close the postgres pool.', { cause: error });
      }
    }
  };
}
