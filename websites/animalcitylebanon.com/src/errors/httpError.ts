export interface FieldErrors {
  [field: string]: string;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly expose: boolean;
  public readonly fields: FieldErrors | undefined;

  constructor(status: number, message: string, options: { expose?: boolean; fields?: FieldErrors; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'HttpError';
    this.status = status;
    this.expose = options.expose ?? status < 500;
    this.fields = options.fields;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'The request is invalid.', fields?: FieldErrors) {
    super(400, message, fields ? { fields } : {});
    this.name = 'BadRequestError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string, cause?: unknown) {
    super(503, message, { expose: true, cause });
    this.name = 'ServiceUnavailableError';
  }
}
