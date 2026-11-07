import type { PublicUser } from '../domain/models.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: PublicUser;
    }
  }
}

export {};
