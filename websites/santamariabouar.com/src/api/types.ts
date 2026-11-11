import type { User } from '../../admin/services/usersService';

export type ApiUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'status' | 'walletEnabled'>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiUser?: ApiUser;
    }
  }
}
