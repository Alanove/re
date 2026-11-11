import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { ApartmentsService } from '../services/apartmentsService';
import { UsersService, User } from '../services/usersService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { StorageService } from '../services/storageService';
import { getApartmentImageUrl, getApartmentDirPath } from '../../src/constants';
import { safegateService } from '../../src/services/safegateService';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const menuService = AdminMenuService.getInstance();
const apartmentsService = ApartmentsService.getInstance();
const usersService = new UsersService();
const siteSettingsService = SiteSettingsService.getInstance();
const storageService = StorageService.getInstance();

export class ApartmentsController {
  private static parseOptionalUserId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const id = parseInt(String(value));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private static parseGateAccessUserIds(value: unknown): number[] {
    if (!value) {
      return [];
    }
    const raw = Array.isArray(value) ? value : [value];
    return [...new Set(
      raw
        .map((v) => parseInt(String(v)))
        .filter((id) => Number.isFinite(id) && id > 0)
    )];
  }

  private static getSessionUserId(req: Request): number | null {
    return (req.session as any).user?.id
      || (req.session as any).adminUser?.id
      || (req.session as any).userId
      || null;
  }

  private static validateRenterForStatus(
    status: string | null | undefined,
    renterId: number | null,
    redirectPath: string,
    res: Response
  ): boolean {
    if (status === 'rented' && !renterId) {
      res.redirect(`${redirectPath}?error=${encodeURIComponent('Renter is required when status is Rented')}`);
      return false;
    }
    return true;
  }

  /**
   * Render apartments management page
   */
  public static async apartments(req: Request, res: Response): Promise<void> {
    try {
      // Get all apartments with owner information
      const apartments = await apartmentsService.getAllApartments();
      const ApartmentWalletService = require('../services/apartmentWalletService').ApartmentWalletService;
      const walletService = ApartmentWalletService.getInstance();
      const walletBalances = await walletService.getBalancesByApartmentId();
      const apartmentsWithWallets = apartments.map(apt => ({
        ...apt,
        walletBalance: walletBalances.get(apt.id) || 0
      }));
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get categories for bulk invoice creation
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      const categories = await categoriesService.getAllCategories();

      res.render('apartments/apartments', {
        title: 'Apartments Management',
        pageTitle: 'Apartments Management',
        pageSubtitle: 'Manage apartment listings',
        apartments: apartmentsWithWallets,
        categories: categories,
        siteTitle,
        success: req.query['success'],
        error: req.query['error'],
        pageCSS: ''
      });
    } catch (error) {
      console.error('Error rendering apartments:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render create apartment form
   */
  public static async createApartment(req: Request, res: Response): Promise<void> {
    try {
      const users = (await usersService.getAllUsers()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      const availableBlocks = apartmentsService.getAvailableBlocks();
      const availableStatuses = apartmentsService.getAvailableStatuses();
      const siteTitle = await siteSettingsService.getSiteTitle();

      res.render('apartments/edit-apartment', {
        title: 'Add Apartment',
        pageTitle: 'Add Apartment',
        pageSubtitle: 'Create a new apartment listing',
        apartment: null,
        users,
        availableBlocks,
        availableStatuses,
        siteTitle,
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering create apartment form:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle create apartment form submission
   */
  public static async createApartmentPost(req: Request, res: Response): Promise<void> {
    try {
      const { ownerId, renterId, block, unitNumberUnofficial, unitNumberOfficial, areaInM2, notes, status, registrationDate } = req.body;
      const parsedRenterId = ApartmentsController.parseOptionalUserId(renterId);
      const changedBy = ApartmentsController.getSessionUserId(req);

      // Validation
      if (!ownerId || !block || !unitNumberUnofficial || !unitNumberOfficial || !areaInM2 || !registrationDate) {
        return res.redirect('/admin/apartments/create?error=All required fields must be filled');
      }

      // Check if unit numbers are already taken in the same block
      if (await apartmentsService.isUnitNumberTaken(unitNumberUnofficial, block) || 
          await apartmentsService.isUnitNumberTaken(unitNumberOfficial, block)) {
        return res.redirect('/admin/apartments/create?error=Unit number already exists in this block');
      }

      // Validate owner exists
      const owner = await usersService.getUserById(parseInt(ownerId));
      if (!owner) {
        return res.redirect('/admin/apartments/create?error=Invalid owner selected');
      }

      if (parsedRenterId) {
        const renter = await usersService.getUserById(parsedRenterId);
        if (!renter) {
          return res.redirect('/admin/apartments/create?error=Invalid renter selected');
        }
      }

      if (!ApartmentsController.validateRenterForStatus(status, parsedRenterId, '/admin/apartments/create', res)) {
        return;
      }

      // Validate block
      const availableBlocks = apartmentsService.getAvailableBlocks();
      if (!availableBlocks.includes(block)) {
        return res.redirect('/admin/apartments/create?error=Invalid block selected');
      }

      // Create apartment
      const newApartment = await apartmentsService.addApartment({
        ownerId: parseInt(ownerId),
        renterId: parsedRenterId,
        block: block as any,
        unitNumberUnofficial,
        unitNumberOfficial,
        areaInM2: parseFloat(areaInM2),
        status: status || null,
        registrationDate: registrationDate,
        officialImage: '',
        images: [],
        isVacant: false,
        notes: notes || undefined
      }, changedBy != null ? { changedBy } : undefined);

      res.redirect(`/admin/apartments/${newApartment.id}/edit?success=Apartment created successfully&tab=gate-access`);
    } catch (error) {
      console.error('Error creating apartment:', error);
      res.redirect('/admin/apartments/create?error=Failed to create apartment');
    }
  }

  /**
   * Render edit apartment form
   */
  public static async editApartment(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }
      const users = (await usersService.getAllUsers()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      const availableBlocks = apartmentsService.getAvailableBlocks();
      const availableStatuses = apartmentsService.getAvailableStatuses();
      const siteTitle = await siteSettingsService.getSiteTitle();
      
      // Get invoices for this apartment
      const InvoicesService = require('../services/invoicesService').InvoicesService;
      const invoicesService = InvoicesService.getInstance();
      const apartmentInvoices = await invoicesService.getInvoicesByApartment(apartmentId);



      // Prepare payments data
      // Map invoices to payment objects
      // Get price per meter history
      const PaymentsService = require('../services/paymentsService').PaymentsService;
      const paymentsService = PaymentsService.getInstance();
      const prices = await paymentsService.getAllPricePerMeter();
      
      const apartmentPayments = apartmentInvoices.map((invoice: any) => {
        const priceEntry = prices.find((p: { year: number; price: number }) => p.year === invoice.year);
        const pricePerM2 = priceEntry ? priceEntry.price : 0;
        
        return {
          year: invoice.year,
          startDate: invoice.invoiceDate, // Using invoice date as start/registration date reference
          areaInM2: apartment.areaInM2,
          pricePerM2: pricePerM2,
          totalAmount: invoice.amount,
          amountPaid: invoice.amountPaid,
          status: invoice.status
        };
      }).sort((a: any, b: any) => b.year - a.year);

      // Calculate stats
      const totalAmount = apartmentPayments.reduce((sum: number, p: any) => sum + p.totalAmount, 0);
      const totalPaid = apartmentPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
      
      const paymentStats = {
        totalPayments: apartmentPayments.length,
        totalAmount: totalAmount,
        totalPaid: totalPaid,
        totalOutstanding: totalAmount - totalPaid
      };

      const ownerHistory = await apartmentsService.getOwnerHistory(apartmentId);
      const apartmentUsers = await apartmentsService.listApartmentUsers(apartmentId);

      return res.render('apartments/edit-apartment', {
        title: 'Edit Apartment',
        pageTitle: 'Edit Apartment',
        pageSubtitle: 'Update apartment information',
        apartment,
        users,
        ownerHistory,
        apartmentUsers,
        gateAccessRelations: apartmentsService.getGateAccessRelations(),
        originalOwnerId: apartment.ownerId,
        originalRenterId: apartment.renterId || null,
        originalOwnerName: apartment.ownerName || '',
        originalRenterName: apartment.renterName || '',
        activeTab: req.query['tab'] || 'details',
        availableBlocks,
        availableStatuses,
        siteTitle,
        apartmentInvoices,
        apartmentPayments,
        paymentStats,
        success: req.query['success'],
        error: req.query['error']
      });
    } catch (error) {
      console.error('Error rendering edit apartment form:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle edit apartment form submission
   */
  public static async editApartmentPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const { ownerId, renterId, block, unitNumberUnofficial, unitNumberOfficial, areaInM2, notes, status, registrationDate, isVacant } = req.body;
      const parsedRenterId = ApartmentsController.parseOptionalUserId(renterId);
      const changedBy = ApartmentsController.getSessionUserId(req);

      // Validation
      if (!ownerId || !block || !unitNumberUnofficial || !unitNumberOfficial || !areaInM2) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=All required fields must be filled`);
      }

      // Get current apartment to compare
      const currentApartment = await apartmentsService.getApartmentById(apartmentId);
      if (!currentApartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      // Check if unit numbers are already taken in the same block (excluding current apartment)
      // Only check if the unit numbers have changed or block has changed
      const unofficialChanged = unitNumberUnofficial !== currentApartment.unitNumberUnofficial;
      const officialChanged = unitNumberOfficial !== currentApartment.unitNumberOfficial;
      const blockChanged = block !== currentApartment.block;
      
      // If unit number or block changed, check for duplicates in the new block
      if ((unofficialChanged || blockChanged) && await apartmentsService.isUnitNumberTaken(unitNumberUnofficial, block, apartmentId)) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Unofficial unit number already exists in this block`);
      }
      
      if ((officialChanged || blockChanged) && await apartmentsService.isUnitNumberTaken(unitNumberOfficial, block, apartmentId)) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Official unit number already exists in this block`);
      }

      // Validate owner exists
      const owner = await usersService.getUserById(parseInt(ownerId));
      if (!owner) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Invalid owner selected`);
      }

      if (parsedRenterId) {
        const renter = await usersService.getUserById(parsedRenterId);
        if (!renter) {
          return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Invalid renter selected`);
        }
      }

      if (!ApartmentsController.validateRenterForStatus(status, parsedRenterId, `/admin/apartments/${apartmentId}/edit`, res)) {
        return;
      }

      // Validate block
      const availableBlocks = apartmentsService.getAvailableBlocks();
      if (!availableBlocks.includes(block)) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=Invalid block selected`);
      }

      // Update apartment
      const updatedApartment = await apartmentsService.updateApartment(apartmentId, {
        ownerId: parseInt(ownerId),
        renterId: parsedRenterId,
        block: block as any,
        unitNumberUnofficial,
        unitNumberOfficial,
        areaInM2: parseFloat(areaInM2),
        status: status || null,
        isVacant: isVacant === '1' || isVacant === true || isVacant === 'true',
        registrationDate: registrationDate,
        notes: notes || undefined
      }, changedBy != null ? { changedBy } : undefined);

      if (!updatedApartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      res.redirect(`/admin/apartments/${apartmentId}/edit?success=Apartment updated successfully`);
    } catch (error) {
      console.error('Error updating apartment:', error);
      res.redirect(`/admin/apartments/${req.params.id}/edit?error=Failed to update apartment`);
    }
  }

  /**
   * Handle apartment deletion
   */
  public static async deleteApartment(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const success = await apartmentsService.deleteApartment(apartmentId);

      if (success) {
        res.json({ success: true, message: 'Apartment deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Apartment not found' });
      }
    } catch (error) {
      console.error('Error deleting apartment:', error);
      res.status(500).json({ success: false, message: 'Failed to delete apartment' });
    }
  }

  /**
   * Get apartments statistics for dashboard
   */
  public static async getApartmentStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await apartmentsService.getApartmentStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting apartment stats:', error);
      res.status(500).json({ error: 'Failed to get apartment statistics' });
    }
  }

  /**
   * Upload official image for apartment
   */
  public static async uploadOfficialImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.status(404).json({ success: false, message: 'Apartment not found' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      // Delete old official image if exists
      if (apartment.officialImage) {
        const oldImagePath = path.join(getApartmentDirPath(apartmentId), apartment.officialImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Set new official image
      await apartmentsService.setOfficialImage(apartmentId, req.file.filename);

      res.json({
        success: true,
        message: 'Official image uploaded successfully',
        imageUrl: getApartmentImageUrl(apartmentId, req.file.filename)
      });
    } catch (error) {
      console.error('Error uploading official image:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }

  /**
   * Upload additional images for apartment
   */
  public static async uploadImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.status(404).json({ success: false, message: 'Apartment not found' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      // Add image to apartment
      await apartmentsService.addImageToApartment(apartmentId, req.file.filename);

      res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: getApartmentImageUrl(apartmentId, req.file.filename),
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }

  /**
   * Delete apartment image
   */
  public static async deleteImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const imageName = req.params.imageName;
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.status(404).json({ success: false, message: 'Apartment not found' });
      }

      // Delete physical file
      const imagePath = path.join(getApartmentDirPath(apartmentId), imageName);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      // Remove from apartment data
      if (apartment.officialImage === imageName) {
        await apartmentsService.removeOfficialImage(apartmentId);
      } else {
        await apartmentsService.removeImageFromApartment(apartmentId, imageName);
      }

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ success: false, message: 'Failed to delete image' });
    }
  }

  /**
   * Set image as official
   */
  public static async setOfficialImage(req: Request, res: Response): Promise<Response | void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const imageName = req.params.imageName;
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.status(404).json({ success: false, message: 'Apartment not found' });
      }

      // Check if image exists in apartment images
      if (!apartment.images.includes(imageName)) {
        return res.status(400).json({ success: false, message: 'Image not found in apartment gallery' });
      }

      // Remove from images array and set as official
      await apartmentsService.removeImageFromApartment(apartmentId, imageName);
      await apartmentsService.setOfficialImage(apartmentId, imageName);

      res.json({
        success: true,
        message: 'Image set as official successfully'
      });
    } catch (error) {
      console.error('Error setting official image:', error);
      res.status(500).json({ success: false, message: 'Failed to set official image' });
    }
  }

  /**
   * Get unsettled years for an apartment
   */
  public static async getUnsettledYears(req: Request, res: Response): Promise<Response | void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const apartment = await apartmentsService.getApartmentById(apartmentId);

      if (!apartment) {
        return res.status(404).json({ success: false, message: 'Apartment not found' });
      }

      // Get all invoices for this apartment
      const InvoicesService = require('../services/invoicesService').InvoicesService;
      const invoicesService = InvoicesService.getInstance();
      const apartmentInvoices = await invoicesService.getInvoicesByApartment(apartmentId);
      
      // Filter invoices that have outstanding amounts (unsettled) - only common expense invoices
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      const allCategories = await categoriesService.getAllCategories();
      const commonExpenseCategory = allCategories.find((cat: { name: string; id: number }) => cat.name.toLowerCase() === 'common expenses');
      
      const commonExpenseInvoices = commonExpenseCategory 
        ? apartmentInvoices.filter((inv: { categoryId: number }) => inv.categoryId === commonExpenseCategory.id)
        : [];
      
      const unsettledInvoices = commonExpenseInvoices.filter((invoice: { amount: number; amountPaid: number; year?: number | null }) => {
        const balance = invoice.amount - invoice.amountPaid;
        return invoice.year && invoice.year > 0 && balance > 0;
      });

      // Sort by year (oldest first)
      const years = unsettledInvoices
        .map((invoice: { year?: number | null; amount: number; amountPaid: number }) => ({
          year: invoice.year!,
          outstandingAmount: invoice.amount - invoice.amountPaid
        }))
        .sort((a: { year: number }, b: { year: number }) => a.year - b.year);

      // Get credit information from invoice_transactions (credits have invoice_id = NULL)
      const InvoiceTransactionsService = require('../services/invoiceTransactionsService').InvoiceTransactionsService;
      const invoiceTransactionsService = InvoiceTransactionsService.getInstance();
      const credits = await invoiceTransactionsService.getCreditsByApartmentId(apartmentId);
      const totalCredit = credits.reduce((sum: number, credit: { amount: number }) => sum + credit.amount, 0);

      res.json({
        success: true,
        years,
        creditAvailable: totalCredit
      });
    } catch (error) {
      console.error('Error getting unsettled years:', error);
      res.status(500).json({ success: false, message: 'Failed to get unsettled years' });
    }
  }

  /**
   * Display apartment payment statement
   */
  public static async apartmentStatement(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      
      // Get apartment details
      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        res.status(404).send('Apartment not found');
        return;
      }

      // Get owner info
      const owner = await usersService.getUserById(apartment.ownerId);
      
      // Get site settings for logo
      const siteSettings = await siteSettingsService.getAllSettings();
      
      // Get invoices for this apartment (status computed on-the-fly from invoice_transactions)
      const InvoicesService = require('../services/invoicesService').InvoicesService;
      const invoicesService = InvoicesService.getInstance();
      const recalculatedInvoices = await invoicesService.getInvoicesByApartment(apartmentId);
      
      // Get transactions for this apartment
      const TransactionsService = require('../services/transactionsService').TransactionsService;
      const transactionsService = TransactionsService.getInstance();
      const AccountsService = require('../services/accountsService').AccountsService;
      const accountsService = AccountsService.getInstance();
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      
      const allTransactions = await transactionsService.getAllTransactions();
      const apartmentTransactions = allTransactions.filter((t: any) => t.apartmentId === apartmentId);
      
      // Enrich transactions with account and category info
      const accounts = await accountsService.getAllAccounts();
      const categories = await categoriesService.getAllCategories();
      
      const enrichedTransactions = apartmentTransactions.map((transaction: any) => {
        const account = accounts.find((a: any) => a.id === transaction.accountId);
        const category = categories.find((c: any) => c.id === transaction.categoryId);
        return {
          ...transaction,
          accountName: account ? account.name : 'Unknown',
          categoryName: category ? category.name : 'Unknown',
          categoryColor: category ? category.color : '#999999'
        };
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Track which transactions have been matched to invoices
      const matchedTransactionIds = new Set<number>();
      
      // First pass: match transactions with direct invoice links
      apartmentTransactions.forEach((t: any) => {
        if (t.invoiceId !== null && t.invoiceId !== undefined) {
          matchedTransactionIds.add(t.id);
        }
      });
      
      // Enrich invoices with category info (amounts already recalculated in database)
      // Process invoices in date order (oldest first) to match transactions chronologically
      const sortedInvoices = [...recalculatedInvoices].sort((a: any, b: any) => 
        new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
      );
      
      // Enrich invoices with category info (amounts already recalculated in database)
      const enrichedInvoices = sortedInvoices.map((invoice: any) => {
        const category = categories.find((c: any) => c.id === invoice.categoryId);
        
        // Calculate balance and ensure status is correct
        const balance = invoice.amount - invoice.amountPaid;
        let status = invoice.status;
        if (invoice.amountPaid >= invoice.amount) {
          status = 'paid';
        } else if (invoice.amountPaid > 0) {
          status = 'partial';
        } else {
          status = 'unpaid';
        }
        
        return {
          ...invoice,
          categoryName: category ? category.name : 'Unknown',
          categoryColor: category ? category.color : '#999999',
          balance: balance,
          status: status // Ensure status matches calculated amount
        };
      }).sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

      const ApartmentWalletService = require('../services/apartmentWalletService').ApartmentWalletService;
      const walletService = ApartmentWalletService.getInstance();
      const walletBalance = await walletService.getTotalBalance(apartmentId);
      
      res.render('apartments/statement', {
        title: 'Account Statement',
        apartment,
        owner,
        siteSettings,
        invoices: enrichedInvoices,
        transactions: enrichedTransactions,
        walletBalance,
        layout: false // Don't use admin layout for statement
      });
    } catch (error) {
      console.error('Error generating apartment statement:', error);
      res.status(500).send('Error generating statement');
    }
  }

  /**
   * Handle bulk invoice creation for selected apartments
   */
  public static async bulkCreateInvoices(req: Request, res: Response): Promise<Response | void> {
    try {
      const { apartmentIds, categoryId, amount, description, dueDate, invoiceDate, year, notes } = req.body;
      
      // Get userId from session
      const userId = (req.session as any).user?.id || (req.session as any).adminUser?.id || (req.session as any).userId || null;

      if (!apartmentIds || !Array.isArray(apartmentIds) || apartmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No apartments selected'
        });
      }

      if (!categoryId || !amount || !invoiceDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields (category, amount, invoice date)'
        });
      }

      const InvoicesService = require('../services/invoicesService').InvoicesService;
      const invoicesService = InvoicesService.getInstance();

      let createdCount = 0;
      const errors: string[] = [];

      // Create invoice for each selected apartment
      for (const apartmentId of apartmentIds) {
        try {
          await invoicesService.createInvoice({
            apartmentId: parseInt(apartmentId),
            categoryId: parseInt(categoryId),
            amount: parseFloat(amount),
            description: description || '',
            dueDate: dueDate || null,
            invoiceDate: invoiceDate,
            year: year ? parseInt(year) : null,
            notes: notes || null,
            createdBy: userId
          });
          createdCount++;
        } catch (error) {
          console.error(`Error creating invoice for apartment ${apartmentId}:`, error);
          errors.push(`Apartment ${apartmentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (createdCount > 0) {
        res.json({
          success: true,
          message: `Successfully created ${createdCount} invoice(s)${errors.length > 0 ? `. ${errors.length} failed.` : ''}`,
          createdCount,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to create any invoices',
          errors
        });
      }
    } catch (error) {
      console.error('Error creating bulk invoices:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create bulk invoices'
      });
    }
  }

  /**
   * Add main gate access for an apartment
   */
  public static async addGateAccessPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const userId = parseInt(req.body.userId);
      const relation = String(req.body.relation || 'Other').trim();
      const expiryDate = String(req.body.expiryDate || '').trim() || null;

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      if (!Number.isFinite(userId) || userId <= 0) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&error=Please select a user`);
      }

      const allowedRelations = apartmentsService.getGateAccessRelations();
      if (!allowedRelations.includes(relation as any)) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&error=Invalid relation selected`);
      }

      const user = await usersService.getUserById(userId);
      if (!user) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&error=Invalid user selected`);
      }

      const added = await apartmentsService.upsertGateAccessUser(apartmentId, userId, relation, expiryDate);
      if (!added) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&error=Failed to add gate access`);
      }

      const cloud = await safegateService.syncGrantForUser(user, expiryDate);
      const message = cloud.message
        ? `Gate access added successfully. ${cloud.message}`
        : 'Gate access added successfully';
      res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&success=${encodeURIComponent(message)}`);
    } catch (error) {
      console.error('Error adding gate access:', error);
      res.redirect(`/admin/apartments/${req.params.id}/edit?tab=gate-access&error=Failed to add gate access`);
    }
  }

  /**
   * Revoke main gate access for a user on an apartment
   */
  public static async revokeGateAccessPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      const user = await usersService.getUserById(userId);
      const removed = await apartmentsService.removeGateAccessUser(apartmentId, userId);
      if (!removed) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&error=Gate access entry not found`);
      }

      let message = 'Gate access revoked successfully';
      if (user) {
        const cloud = await safegateService.syncRevokeAfterGateRemoval(user);
        if (cloud.message) {
          message += `. ${cloud.message}`;
        }
      }
      res.redirect(`/admin/apartments/${apartmentId}/edit?tab=gate-access&success=${encodeURIComponent(message)}`);
    } catch (error) {
      console.error('Error revoking gate access:', error);
      res.redirect(`/admin/apartments/${req.params.id}/edit?tab=gate-access&error=Failed to revoke gate access`);
    }
  }

  public static async addApartmentMemberPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id, 10);
      const userId = parseInt(String(req.body.userId || ''), 10);
      const role = String(req.body.role || 'owner').toLowerCase() === 'tenant' ? 'tenant' : 'owner';
      const makePrimary = String(req.body.makePrimary || '') === '1' || String(req.body.makePrimary || '') === 'on';
      const changedBy = ApartmentsController.getSessionUserId(req);

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      if (!Number.isFinite(userId) || userId <= 0) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=` + encodeURIComponent('Please select a member'));
      }

      const user = await usersService.getUserById(userId);
      if (!user) {
        return res.redirect(`/admin/apartments/${apartmentId}/edit?error=` + encodeURIComponent('Invalid member selected'));
      }

      const isPrimary = role === 'owner' && (makePrimary || !apartment.ownerId);
      await apartmentsService.addApartmentUser(apartmentId, userId, role, {
        isPrimary,
        changedBy: changedBy || undefined
      });

      res.redirect(
        `/admin/apartments/${apartmentId}/edit?success=` +
          encodeURIComponent(`${role === 'tenant' ? 'Tenant' : 'Owner'} linked successfully`)
      );
    } catch (error) {
      console.error('Error adding apartment member:', error);
      res.redirect(
        `/admin/apartments/${req.params.id}/edit?error=` + encodeURIComponent('Failed to add member')
      );
    }
  }

  public static async setPrimaryOwnerPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);
      const changedBy = ApartmentsController.getSessionUserId(req);

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      await apartmentsService.setPrimaryOwner(apartmentId, userId, {
        changedBy: changedBy || undefined
      });

      res.redirect(
        `/admin/apartments/${apartmentId}/edit?success=` + encodeURIComponent('Primary owner updated')
      );
    } catch (error) {
      console.error('Error setting primary owner:', error);
      res.redirect(
        `/admin/apartments/${req.params.id}/edit?error=` + encodeURIComponent('Failed to set primary owner')
      );
    }
  }

  public static async removeApartmentMemberPost(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);
      const role = String(req.params.role || 'owner').toLowerCase() === 'tenant' ? 'tenant' : 'owner';
      const changedBy = ApartmentsController.getSessionUserId(req);

      const apartment = await apartmentsService.getApartmentById(apartmentId);
      if (!apartment) {
        return res.redirect('/admin/apartments?error=Apartment not found');
      }

      const removed = await apartmentsService.removeApartmentUser(apartmentId, userId, role, {
        changedBy: changedBy || undefined
      });
      if (!removed) {
        return res.redirect(
          `/admin/apartments/${apartmentId}/edit?error=` + encodeURIComponent('Member link not found')
        );
      }

      res.redirect(
        `/admin/apartments/${apartmentId}/edit?success=` + encodeURIComponent('Member removed from apartment')
      );
    } catch (error) {
      console.error('Error removing apartment member:', error);
      res.redirect(
        `/admin/apartments/${req.params.id}/edit?error=` + encodeURIComponent('Failed to remove member')
      );
    }
  }

  /**
   * Export apartments to Excel
   */
  public static async exportExcel(req: Request, res: Response): Promise<void> {
    try {
      const apartments = await apartmentsService.getAllApartments();
      
      const data = await Promise.all(apartments.map(async (apt) => ({
        'Owner Name': apt.ownerName || '',
        'Phone Number': apt.ownerPhone || '',
        'Renter Name': apt.renterName || '',
        'Gate Access Users': (apt.gateAccessUsers || []).map((u) => `${u.name} (${u.relation})`).join(', '),
        'Previous Owners': await apartmentsService.getPreviousOwnersSummary(apt.id),
        'Block': apt.block || '',
        'Unit Number (Official)': apt.unitNumberOfficial || '',
        'Unit Number (Unofficial)': apt.unitNumberUnofficial || ''
      })));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Apartments');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="apartments.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting apartments:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
