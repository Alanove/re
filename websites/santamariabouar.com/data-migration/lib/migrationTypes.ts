export interface MigrationContext {
  log: (message: string) => void;
}

export type MigrationRunnerFn = (ctx: MigrationContext) => Promise<void>;
