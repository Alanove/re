import type { Request, Response } from 'express';

export interface MockResponse {
  res: Response;
  statusCode: number;
  body: any;
}

export function mockResponse(): MockResponse {
  const state: MockResponse = { res: {} as Response, statusCode: 200, body: undefined };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    }
  };
  state.res = res as Response;
  return state;
}

export function mockRequest(overrides: Partial<Request> & { headers?: Record<string, string> } = {}): Request {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides
  } as unknown as Request;
}

export async function runMiddleware(
  middleware: (req: Request, res: Response, next: (err?: unknown) => void) => unknown,
  req: Request
): Promise<{ response: MockResponse; nextCalled: boolean; nextError: unknown }> {
  const response = mockResponse();
  let nextCalled = false;
  let nextError: unknown;
  await middleware(req, response.res, (err?: unknown) => {
    nextCalled = true;
    nextError = err;
  });
  return { response, nextCalled, nextError };
}
