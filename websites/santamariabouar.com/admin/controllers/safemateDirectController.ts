import { Request, Response } from 'express';
import { isProtectedSafemateAccount, SafemateSubUser, safegateService } from '../../src/services/safegateService';

function redirectToPage(res: Response, key: 'success' | 'error', message: string, search?: string): void {
  const params = new URLSearchParams();
  if (search) {
    params.set('q', search);
  }
  params.set(key, message);
  res.redirect(`/admin/safemate-direct?${params.toString()}`);
}

function rowMatchesQuery(user: SafemateSubUser, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [user.account, user.phone, user.email].some((value) => value.toLowerCase().includes(needle));
}

export class SafemateDirectController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q || '').trim();
      const listed = await safegateService.listSubUsers();
      const users = listed.users.filter((user) => rowMatchesQuery(user, q));

      res.render('safemate-direct/index', {
        title: 'SafeMate Direct',
        pageTitle: 'SafeMate Direct',
        pageSubtitle: 'SafeMate cloud accounts only',
        user: (req.session as any).user,
        users,
        totalCount: listed.users.length,
        q,
        cloudOk: listed.ok,
        cloudMessage: listed.ok ? '' : (listed.message || 'SafeMate is unreachable.'),
        success: req.query.success,
        error: req.query.error,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error loading SafeMate Direct:', error);
      res.status(500).render('admin/error', {
        message: 'Error loading SafeMate Direct',
        error
      });
    }
  }

  static async addPost(req: Request, res: Response): Promise<void> {
    const q = String(req.body.q || '').trim();
    try {
      const result = await safegateService.createDirectAccount({
        account: req.body.account,
        name: req.body.name,
        email: req.body.email,
        validDate: req.body.validDate
      });
      redirectToPage(res, result.ok ? 'success' : 'error', result.message || 'SafeMate could not create the account.', q);
    } catch (error) {
      console.error('Error creating SafeMate Direct account:', error);
      redirectToPage(res, 'error', 'SafeMate could not create the account.', q);
    }
  }

  static async editPost(req: Request, res: Response): Promise<void> {
    const q = String(req.body.q || '').trim();
    try {
      const account = String(req.body.account || '').trim();
      if (isProtectedSafemateAccount(account)) {
        return redirectToPage(res, 'error', `SafeMate account ${account} is protected and was not changed.`, q);
      }
      const result = await safegateService.updateDirectAccount({
        account,
        name: req.body.name,
        email: req.body.email,
        validDate: req.body.validDate
      });
      redirectToPage(res, result.ok ? 'success' : 'error', result.message || 'SafeMate could not update the account.', q);
    } catch (error) {
      console.error('Error updating SafeMate Direct account:', error);
      redirectToPage(res, 'error', 'SafeMate could not update the account.', q);
    }
  }

  static async deletePost(req: Request, res: Response): Promise<void> {
    const q = String(req.body.q || '').trim();
    try {
      const account = String(req.body.account || '').trim();
      if (isProtectedSafemateAccount(account)) {
        return redirectToPage(res, 'error', `SafeMate account ${account} is protected and was not removed.`, q);
      }
      const result = await safegateService.deleteDirectAccount(account);
      redirectToPage(res, result.ok ? 'success' : 'error', result.message || 'SafeMate could not remove the account.', q);
    } catch (error) {
      console.error('Error deleting SafeMate Direct account:', error);
      redirectToPage(res, 'error', 'SafeMate could not remove the account.', q);
    }
  }
}
