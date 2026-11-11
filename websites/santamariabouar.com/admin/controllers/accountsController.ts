import { Request, Response } from 'express';
import { AccountsService } from '../services/accountsService';
import { SiteSettingsService } from '../services/siteSettingsService';

export class AccountsController {
    private static accountsService = AccountsService.getInstance();
    private static siteSettingsService = SiteSettingsService.getInstance();

    static async accounts(req: Request, res: Response) {
        try {
            const siteTitle = await AccountsController.siteSettingsService.getSiteTitle();
            const accounts = await AccountsController.accountsService.getAllAccountsWithBalance();
            const totalAmount = await AccountsController.accountsService.getTotalAmount();

            res.render('accounts/list', {
                title: 'Accounts Management',
                siteTitle,
                accounts,
                totalAmount,
                currentPage: 'accounts'
            });
        } catch (error) {
            console.error('Error fetching accounts:', error);
            res.status(500).render('error', { 
                message: 'Error loading accounts',
                error: error 
            });
        }
    }

    static async createAccount(req: Request, res: Response) {
        try {
            const siteTitle = await AccountsController.siteSettingsService.getSiteTitle();
            res.render('accounts/create', {
                title: 'Create Account',
                siteTitle,
                currentPage: 'accounts'
            });
        } catch (error) {
            console.error('Error loading create account page:', error);
            res.status(500).render('error', { 
                message: 'Error loading create account page',
                error: error 
            });
        }
    }

    static async createAccountPost(req: Request, res: Response) {
        try {
            const { name, currency, notes } = req.body;

            if (!name) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Name is required' 
                });
            }

            const accountData = {
                name: name.trim(),
                currency: currency || 'USD',
                isActive: true,
                notes: notes?.trim() || ''
            };
            console.log('DEBUG: accountData to be created:', accountData);

            const newAccount = await AccountsController.accountsService.createAccount(accountData);

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, account: newAccount });
            } else {
                res.redirect('/admin/accounts');
            }
        } catch (error) {
            console.error('Error creating account:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error creating account' 
                });
            } else {
                res.status(500).render('error', { 
                    message: 'Error creating account',
                    error: error 
                });
            }
        }
    }

    static async editAccount(req: Request, res: Response) {
        try {
            const siteTitle = await AccountsController.siteSettingsService.getSiteTitle();
            const accountId = parseInt(req.params.id);
            const account = await AccountsController.accountsService.getAccountByIdWithBalance(accountId);
            
            if (!account) {
                return res.status(404).render('error', { 
                    message: 'Account not found' 
                });
            }

            res.render('accounts/edit', {
                title: 'Edit Account',
                siteTitle,
                account,
                currentPage: 'accounts'
            });
        } catch (error) {
            console.error('Error loading edit account page:', error);
            res.status(500).render('error', { 
                message: 'Error loading edit account page',
                error: error 
            });
        }
    }

    static async editAccountPost(req: Request, res: Response) {
        try {
            const accountId = parseInt(req.params.id);
            const { name, currency, notes, isActive } = req.body;

            if (!name) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Name is required' 
                });
            }

            const updateData = {
                name: name.trim(),
                currency: currency || 'USD',
                notes: notes?.trim() || '',
                isActive: isActive === 'on' || isActive === true
            };

            const updatedAccount = await AccountsController.accountsService.updateAccount(accountId, updateData);

            if (!updatedAccount) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Account not found' 
                });
            }

            if (req.headers.accept?.includes('application/json')) {
                res.json({ success: true, account: updatedAccount });
            } else {
                res.redirect('/admin/accounts');
            }
        } catch (error) {
            console.error('Error updating account:', error);
            if (req.headers.accept?.includes('application/json')) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error updating account' 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Error updating account' 
                });
            }
        }
    }

    static async deleteAccount(req: Request, res: Response) {
        try {
            const accountId = parseInt(req.params.id);
            const success = await AccountsController.accountsService.deleteAccount(accountId);

            if (!success) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Account not found' 
                });
            }

            res.json({ success: true, message: 'Account deleted successfully' });
        } catch (error) {
            console.error('Error deleting account:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error deleting account' 
            });
        }
    }

    static async getAccountStats(req: Request, res: Response) {
        try {
            const accounts = await AccountsController.accountsService.getAllAccountsWithBalance();
            const totalAmount = await AccountsController.accountsService.getTotalAmount();

            const stats = {
                totalAccounts: accounts.length,
                activeAccounts: accounts.filter(w => w.isActive).length,
                totalAmount,
                averageBalance: accounts.length > 0 ? totalAmount / accounts.length : 0
            };

            res.json(stats);
        } catch (error) {
            console.error('Error getting account stats:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error getting account stats' 
            });
        }
    }
}

