import { Request, Response } from 'express';

import { ApartmentsService } from '../services/apartmentsService';

import { ApartmentWalletService } from '../services/apartmentWalletService';

import { AccountsService } from '../services/accountsService';

import { SiteSettingsService } from '../services/siteSettingsService';

import { notifyApartmentOfWalletTransaction } from '../../src/services/emailService';



const apartmentsService = ApartmentsService.getInstance();

const walletService = ApartmentWalletService.getInstance();

const accountsService = AccountsService.getInstance();

const siteSettingsService = SiteSettingsService.getInstance();



export class ApartmentWalletController {

  /**

   * List all apartments with wallet balances (Accounting management page).

   */

  public static async list(req: Request, res: Response): Promise<void> {

    try {

      const [apartments, balances, summary, siteTitle] = await Promise.all([

        apartmentsService.getAllApartments(),

        walletService.getBalancesByApartmentId(),

        walletService.getGlobalSummary(),

        siteSettingsService.getSiteTitle()

      ]);



      const blockFilter = (req.query.block as string) || '';

      const searchTerm = ((req.query.search as string) || '').toLowerCase().trim();

      const showOnlyWithBalance = req.query.withBalance === '1';



      let rows = apartments.map(apt => ({

        ...apt,

        walletBalance: balances.get(apt.id) || 0

      }));



      if (blockFilter) {

        rows = rows.filter(apt => apt.block === blockFilter);

      }

      if (searchTerm) {

        rows = rows.filter(apt =>

          (apt.block || '').toLowerCase().includes(searchTerm) ||

          String(apt.unitNumberOfficial || '').toLowerCase().includes(searchTerm) ||

          String(apt.unitNumberUnofficial || '').toLowerCase().includes(searchTerm) ||

          (apt.ownerName || '').toLowerCase().includes(searchTerm)

        );

      }

      if (showOnlyWithBalance) {

        rows = rows.filter(apt => apt.walletBalance > 0.001);

      }



      rows.sort((a, b) => {

        const blockCmp = (a.block || '').localeCompare(b.block || '');

        if (blockCmp !== 0) return blockCmp;

        return String(a.unitNumberOfficial || '').localeCompare(String(b.unitNumberOfficial || ''));

      });



      res.render('wallets/list', {

        title: 'Apartment Wallets',

        pageTitle: 'Apartment Wallets',

        pageSubtitle: 'Manage prepaid balances used to settle common expenses and invoices',

        siteTitle,

        apartments: rows,

        summary,

        filters: {

          block: blockFilter,

          search: req.query.search || '',

          withBalance: showOnlyWithBalance

        },

        success: req.query.success,

        error: req.query.error

      });

    } catch (error) {

      console.error('Error rendering apartment wallets:', error);

      res.status(500).send('Internal Server Error');

    }

  }



  /**

   * Wallet detail for one apartment — view entries and add/edit balances.

   */

  public static async detail(req: Request, res: Response): Promise<void> {

    try {

      const apartmentId = parseInt(req.params.apartmentId, 10);

      if (!Number.isFinite(apartmentId)) {

        res.redirect('/admin/wallets?error=Invalid apartment');

        return;

      }



      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {

        res.redirect('/admin/wallets?error=Apartment not found');

        return;

      }



      const [statement, accounts, siteTitle] = await Promise.all([

        walletService.getWalletStatement(apartmentId),

        accountsService.getAllAccountsWithBalance(),

        siteSettingsService.getSiteTitle()

      ]);



      const defaultDescription = `Wallet top-up – Block ${apartment.block} ${apartment.unitNumberOfficial}`;



      res.render('wallets/detail', {

        title: `Wallet – Block ${apartment.block} ${apartment.unitNumberOfficial}`,

        pageTitle: 'Apartment Wallet',

        pageSubtitle: `Block ${apartment.block} – Unit ${apartment.unitNumberOfficial}${apartment.ownerName ? ` (${apartment.ownerName})` : ''}`,

        siteTitle,

        apartment,

        entries: statement.entries,

        walletBalance: statement.balance,

        totalAdded: statement.totalAdded,

        totalSubtracted: statement.totalSubtracted,

        accounts: accounts.filter((a: { isActive: boolean }) => a.isActive),

        defaultDate: new Date().toISOString().split('T')[0],

        defaultDescription,

        openAction: req.query.action === 'subtract' ? 'subtract' : (req.query.action === 'add' ? 'add' : ''),

        success: req.query.success,

        error: req.query.error

      });

    } catch (error) {

      console.error('Error rendering apartment wallet detail:', error);

      res.status(500).send('Internal Server Error');

    }

  }



  /**

   * Printable statement of all wallet movements for one apartment.

   */

  public static async report(req: Request, res: Response): Promise<void> {

    try {

      const apartmentId = parseInt(req.params.apartmentId, 10);

      if (!Number.isFinite(apartmentId)) {

        res.redirect('/admin/wallets?error=Invalid apartment');

        return;

      }



      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {

        res.redirect('/admin/wallets?error=Apartment not found');

        return;

      }



      const [statement, siteTitle] = await Promise.all([

        walletService.getWalletStatement(apartmentId),

        siteSettingsService.getSiteTitle()

      ]);



      res.render('wallets/report', {

        title: `Wallet Statement – Block ${apartment.block} ${apartment.unitNumberOfficial}`,

        pageTitle: 'Wallet Statement',

        pageSubtitle: `Block ${apartment.block} – Unit ${apartment.unitNumberOfficial}${apartment.ownerName ? ` (${apartment.ownerName})` : ''}`,

        siteTitle,

        apartment,

        entries: statement.entries,

        totalAdded: statement.totalAdded,

        totalSubtracted: statement.totalSubtracted,

        walletBalance: statement.balance,

        reportDate: new Date().toLocaleDateString(),

        user: (req.session as any).user,

        layout: false

      });

    } catch (error) {

      console.error('Error rendering apartment wallet report:', error);

      res.status(500).send('Internal Server Error');

    }

  }



  public static async addEntryPost(req: Request, res: Response): Promise<Response | void> {

    try {

      const apartmentId = parseInt(req.params.apartmentId, 10);

      const amount = parseFloat(req.body.amount);

      const accountId = parseInt(req.body.accountId, 10);

      const date = String(req.body.date || '').trim();

      const description = String(req.body.description || '').trim();



      const userId =

        (req.session as any).user?.id ||

        (req.session as any).adminUser?.id ||

        (req.session as any).userId ||

        null;



      if (!Number.isFinite(apartmentId) || !Number.isFinite(amount)) {

        return res.status(400).json({ success: false, message: 'Invalid apartment or amount' });

      }

      if (!Number.isFinite(accountId)) {

        return res.status(400).json({ success: false, message: 'Account is required' });

      }

      if (!date) {

        return res.status(400).json({ success: false, message: 'Date is required' });

      }



      const result = await walletService.addWalletEntryWithTransaction({

        apartmentId,

        amount,

        accountId,

        date,

        description,

        createdBy: userId

      });



      void notifyApartmentOfWalletTransaction({

        apartmentId,

        kind: 'deposit',

        amount,

        date,

        description

      });



      res.json({

        success: true,

        message: 'Wallet balance recorded as transaction',

        transactionId: result.transactionId

      });

    } catch (error: any) {

      console.error('Error adding wallet entry:', error);

      res.status(400).json({ success: false, message: error.message || 'Failed to add wallet entry' });

    }

  }



  public static async subtractEntryPost(req: Request, res: Response): Promise<Response | void> {

    try {

      const apartmentId = parseInt(req.params.apartmentId, 10);

      const amount = parseFloat(req.body.amount);

      const accountId = parseInt(req.body.accountId, 10);

      const date = String(req.body.date || '').trim();

      const description = String(req.body.description || '').trim();



      const userId =

        (req.session as any).user?.id ||

        (req.session as any).adminUser?.id ||

        (req.session as any).userId ||

        null;



      if (!Number.isFinite(apartmentId) || !Number.isFinite(amount)) {

        return res.status(400).json({ success: false, message: 'Invalid apartment or amount' });

      }

      if (!Number.isFinite(accountId)) {

        return res.status(400).json({ success: false, message: 'Account is required' });

      }

      if (!date) {

        return res.status(400).json({ success: false, message: 'Date is required' });

      }

      if (!description) {

        return res.status(400).json({ success: false, message: 'Description is required' });

      }



      const result = await walletService.subtractWalletEntryWithTransaction({

        apartmentId,

        amount,

        accountId,

        date,

        description,

        createdBy: userId

      });



      void notifyApartmentOfWalletTransaction({

        apartmentId,

        kind: 'deduction',

        amount,

        date,

        description

      });



      res.json({

        success: true,

        message: 'Wallet deduction recorded as transaction',

        transactionId: result.transactionId

      });

    } catch (error: any) {

      console.error('Error subtracting wallet entry:', error);

      res.status(400).json({ success: false, message: error.message || 'Failed to subtract wallet balance' });

    }

  }



  public static async updateEntryPost(req: Request, res: Response): Promise<Response | void> {

    try {

      const entryId = parseInt(req.params.entryId, 10);

      const amount = parseFloat(req.body.amount);

      const description = req.body.description !== undefined
        ? String(req.body.description || '').trim()
        : undefined;



      if (!Number.isFinite(entryId) || !Number.isFinite(amount)) {

        return res.status(400).json({ success: false, message: 'Invalid entry or amount' });

      }



      await walletService.updateWalletEntry(entryId, amount, description);

      res.json({ success: true, message: 'Wallet entry updated successfully' });

    } catch (error: any) {

      console.error('Error updating wallet entry:', error);

      res.status(400).json({ success: false, message: error.message || 'Failed to update wallet entry' });

    }

  }



  public static async deleteEntryPost(req: Request, res: Response): Promise<Response | void> {

    try {

      const entryId = parseInt(req.params.entryId, 10);

      if (!Number.isFinite(entryId)) {

        return res.status(400).json({ success: false, message: 'Invalid entry' });

      }



      const deleted = await walletService.deleteWalletEntry(entryId);

      if (!deleted) {

        return res.status(400).json({ success: false, message: 'Entry could not be deleted' });

      }



      res.json({ success: true, message: 'Wallet entry removed successfully' });

    } catch (error: any) {

      console.error('Error deleting wallet entry:', error);

      res.status(400).json({ success: false, message: error.message || 'Failed to delete wallet entry' });

    }

  }

}


