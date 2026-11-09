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

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication is required.') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'You are not allowed to do that.') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'The requested resource was not found.') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string, cause?: unknown) {
    super(503, message, { expose: true, cause });
    this.name = 'ServiceUnavailableError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, fields?: FieldErrors) {
    super(409, message, fields ? { fields } : {});
    this.name = 'ConflictError';
  }
}
