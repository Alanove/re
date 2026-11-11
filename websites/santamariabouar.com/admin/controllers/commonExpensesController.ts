import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { InvoicesService } from '../services/invoicesService';
import { ApartmentsService } from '../services/apartmentsService';
import { UsersService } from '../services/usersService';

const menuService = AdminMenuService.getInstance();
const invoicesService = InvoicesService.getInstance();
const apartmentsService = ApartmentsService.getInstance();
const usersService = new UsersService();

export interface CommonExpensesFilters {
  year?: number | undefined;
  block?: string | undefined;
  ownerId?: number | undefined;
  paymentStatus?: 'all' | 'paid' | 'partial' | 'unpaid' | 'partial-unpaid';
  searchTerm?: string | undefined;
}

export interface CommonExpensesData {
  payment: any; // For backward compatibility, can be invoice or apartment_payment
  invoice?: any; // Invoice data
  apartment: any;
  owner: any;
  category?: any; // Category information
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  outstandingAmount: number;
}

export class CommonExpensesController {
  /**
   * Render common expenses page
   */
  public static async commonExpenses(req: Request, res: Response): Promise<void> {
    try {
      // Set active menu item// Get menu data// Get filter parameters
      const filters: CommonExpensesFilters = {
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        block: req.query.block as string || undefined,
        ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined,
        paymentStatus: (req.query.paymentStatus as any) || 'all',
        searchTerm: req.query.search as string || undefined
      };
      
      // Get all apartments and users for filters
      const apartments = await apartmentsService.getAllApartments();
      const users = await usersService.getAllUsers();
      const availableBlocks = apartmentsService.getAvailableBlocks();
      
      // Get categories for invoice enrichment
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      const categories = await categoriesService.getAllCategories();
      
      // Get all invoices filtered by Common Expenses category (status computed on-the-fly)
      const allInvoices = await invoicesService.getAllInvoices();
      const commonExpenseCategory = categories.find((c: { name: string; id: number }) => c.name.toLowerCase() === 'common expenses');
      const commonExpenseInvoices = commonExpenseCategory 
        ? allInvoices.filter(inv => inv.categoryId === commonExpenseCategory.id)
        : [];
      
      // Build report data from invoices only
      const reportData = CommonExpensesController.buildReportDataFromInvoices(commonExpenseInvoices, apartments, users, categories);
      
      // Get available years from invoices
      const availableYears = CommonExpensesController.getAvailableYearsFromInvoices(commonExpenseInvoices);
      
      // Apply filters
      const filteredData = CommonExpensesController.applyFilters(reportData, filters);
      
      // Get statistics
      const stats = CommonExpensesController.calculateStatistics(filteredData);
      
      res.render('common-expenses/common-expenses', {
        title: 'Common Expenses',
        pageTitle: 'Common Expenses',
        pageSubtitle: 'Comprehensive view of all apartment payments with filtering options',
        reportData: filteredData,
        stats,
        filters,
        apartments,
        users,
        availableBlocks,
        availableYears,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error rendering common expenses:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Build report data from invoices with apartment and owner information
   */
  private static buildReportDataFromInvoices(invoices: any[], apartments: any[], users: any[], categories: any[] = []): CommonExpensesData[] {
    return invoices
      .filter(invoice => {
        // Filter out credits and invalid invoices at the source
        const invoiceAmount = parseFloat(invoice.amount || 0);
        const amountPaid = parseFloat(invoice.amountPaid || 0);
        
        // Exclude invoices with negative or zero amounts
        if (invoiceAmount <= 0) {
          return false;
        }
        
        // Exclude credits (where amountPaid >= amount)
        if (amountPaid >= invoiceAmount) {
          return false;
        }
        
        // Exclude invoices with negative outstanding amounts
        const outstanding = invoiceAmount - amountPaid;
        if (outstanding <= 0) {
          return false;
        }
        
        return true;
      })
      .map(invoice => {
        // Handle type coercion for apartment ID matching (number vs string)
        let apartment = apartments.find(apt => 
          apt.id === invoice.apartmentId || 
          String(apt.id) === String(invoice.apartmentId) ||
          Number(apt.id) === Number(invoice.apartmentId)
        );
        
        const owner = users.find(user => user.id === apartment?.ownerId);
        const category = categories.find(cat => cat.id === invoice.categoryId);
        
        const outstandingAmount = invoice.amount - invoice.amountPaid;
        
        // Calculate status based on amounts (not just invoice.status)
        let paymentStatus: 'paid' | 'partial' | 'unpaid';
        if (invoice.amountPaid >= invoice.amount) {
          paymentStatus = 'paid';
        } else if (invoice.amountPaid > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }
        
        return {
          payment: {
            // Map invoice fields to payment-like structure for compatibility
            id: invoice.id,
            apartmentId: invoice.apartmentId,
            year: invoice.year,
            totalAmount: invoice.amount,
            amountPaid: invoice.amountPaid,
            status: paymentStatus, // Use calculated status
            pricePerM2: 0, // Not applicable for invoices
            startDate: invoice.invoiceDate
          },
          invoice: invoice,
          apartment,
          owner,
          category, // Add category to report data
          paymentStatus,
          outstandingAmount
        };
      });
  }


  /**
   * Apply filters to report data
   */
  private static applyFilters(data: CommonExpensesData[], filters: CommonExpensesFilters): CommonExpensesData[] {
    return data.filter(item => {
      // Year filter
      if (filters.year && item.payment.year !== filters.year) {
        return false;
      }
      
      // Get block from apartment or payment's apartmentData (from JOIN)
      const block = item.apartment?.block || (item.payment as any).apartmentData?.block;
      
      // Block filter
      if (filters.block && block !== filters.block) {
        return false;
      }
      
      // Get ownerId from apartment or payment's apartmentData (from JOIN)
      const ownerId = item.apartment?.ownerId || (item.payment as any).apartmentData?.ownerId;
      
      // Owner filter
      if (filters.ownerId && ownerId !== filters.ownerId) {
        return false;
      }
      
      // Payment status filter
      if (filters.paymentStatus !== 'all') {
        if (filters.paymentStatus === 'partial-unpaid') {
          // Show both partial and unpaid
          if (item.paymentStatus !== 'partial' && item.paymentStatus !== 'unpaid') {
            return false;
          }
        } else if (item.paymentStatus !== filters.paymentStatus) {
          return false;
        }
      }
      
      // Search term filter (searches in apartment numbers, owner name, and block)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const apartmentData = (item.payment as any).apartmentData;
        const unitNumberUnofficial = item.apartment?.unitNumberUnofficial || apartmentData?.unitNumberUnofficial;
        const unitNumberOfficial = item.apartment?.unitNumberOfficial || apartmentData?.unitNumberOfficial;
        const apartmentBlock = block;
        
        const apartmentMatch = unitNumberUnofficial?.toLowerCase().includes(searchLower) ||
                              unitNumberOfficial?.toLowerCase().includes(searchLower);
        const ownerMatch = item.owner?.name?.toLowerCase().includes(searchLower) ||
                          item.owner?.email?.toLowerCase().includes(searchLower);
        const blockMatch = apartmentBlock?.toLowerCase().includes(searchLower);
        
        if (!apartmentMatch && !ownerMatch && !blockMatch) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get available years from invoice data
   */
  private static getAvailableYearsFromInvoices(invoices: any[]): number[] {
    const yearsSet = new Set<number>();
    invoices.forEach(invoice => {
      if (invoice.year !== undefined && invoice.year !== null) {
        yearsSet.add(invoice.year);
      }
    });
    
    // Convert to array and sort in descending order (newest first)
    return Array.from(yearsSet).sort((a, b) => b - a);
  }


  /**
   * Calculate statistics for the filtered data
   */
  private static calculateStatistics(data: CommonExpensesData[]): {
    totalPayments: number;
    totalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
    averageOutstanding: number;
  } {
    const totalPayments = data.length;
    const totalAmount = data.reduce((sum, item) => sum + item.payment.totalAmount, 0);
    const totalPaid = data.reduce((sum, item) => sum + item.payment.amountPaid, 0);
    const totalOutstanding = data.reduce((sum, item) => sum + item.outstandingAmount, 0);
    
    const paidCount = data.filter(item => item.paymentStatus === 'paid').length;
    const partialCount = data.filter(item => item.paymentStatus === 'partial').length;
    const unpaidCount = data.filter(item => item.paymentStatus === 'unpaid').length;
    
    const averageOutstanding = totalPayments > 0 ? totalOutstanding / totalPayments : 0;
    
    return {
      totalPayments,
      totalAmount,
      totalPaid,
      totalOutstanding,
      paidCount,
      partialCount,
      unpaidCount,
      averageOutstanding
    };
  }

  /**
   * Export common expenses to CSV
   */
  public static async exportCommonExpenses(req: Request, res: Response): Promise<void> {
    try {
      // Get filter parameters
      const filters: CommonExpensesFilters = {
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        block: req.query.block as string || undefined,
        ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined,
        paymentStatus: (req.query.paymentStatus as any) || 'all',
        searchTerm: req.query.search as string || undefined
      };
      
      // Get all data
      const apartments = await apartmentsService.getAllApartments();
      const users = await usersService.getAllUsers();
      
      // Get categories for invoice display
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      const categories = await categoriesService.getAllCategories();
      
      // Get invoices filtered by Common Expenses category (status computed on-the-fly)
      const allInvoices = await invoicesService.getAllInvoices();
      const commonExpenseCategory = categories.find((c: { name: string; id: number }) => c.name.toLowerCase() === 'common expenses');
      const commonExpenseInvoices = commonExpenseCategory 
        ? allInvoices.filter(inv => inv.categoryId === commonExpenseCategory.id)
        : [];
      
      // Build report data from invoices only
      const reportData = CommonExpensesController.buildReportDataFromInvoices(commonExpenseInvoices, apartments, users, categories);
      const filteredData = CommonExpensesController.applyFilters(reportData, filters);
      
      // Generate CSV
      const csv = CommonExpensesController.generateCSV(filteredData);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="common-expenses-report.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Error exporting common expenses:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Generate CSV content
   */
  private static generateCSV(data: CommonExpensesData[]): string {
    const headers = [
      'Year',
      'Apartment ID',
      'Block',
      'Unit Number (Official)',
      'Unit Number (Unofficial)',
      'Area (m²)',
      'Owner Name',
      'Owner Email',
      'Category',
      'Registration Date',
      'Price per m²',
      'Total Amount',
      'Amount Paid',
      'Outstanding Amount',
      'Payment Status'
    ];
    
    const rows = data.map(item => [
      item.payment.year,
      item.apartment?.id || '',
      item.apartment?.block || '',
      item.apartment?.unitNumberOfficial || '',
      item.apartment?.unitNumberUnofficial || '',
      item.apartment?.areaInM2 || '',
      item.owner?.name || '',
      item.owner?.email || '',
      item.category?.name || '',
      item.apartment?.registrationDate ? new Date(item.apartment.registrationDate).toLocaleDateString() : '',
      item.payment.pricePerM2,
      item.payment.totalAmount,
      item.payment.amountPaid,
      item.outstandingAmount,
      item.paymentStatus
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  /**
   * Render unpaid apartments report grouped by blocks
   */
  public static async unpaidReport(req: Request, res: Response): Promise<void> {
    try {
      // Get filter parameters
      // Default to 'partial-unpaid' to show both partial and unpaid payments (all outstanding)
      const filters: CommonExpensesFilters = {
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        block: req.query.block as string || undefined,
        ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined,
        paymentStatus: (req.query.paymentStatus as any) || 'partial-unpaid',
        searchTerm: req.query.search as string || undefined
      };
      
      // Get all data
      const apartments = await apartmentsService.getAllApartments();
      const users = await usersService.getAllUsers();
      
      // Get categories for invoice display
      const TransactionCategoriesService = require('../services/transactionCategoriesService').TransactionCategoriesService;
      const categoriesService = TransactionCategoriesService.getInstance();
      const categories = await categoriesService.getAllCategories();
      
      // Get unpaid invoices (status computed on-the-fly from invoice_transactions)
      const invoiceFilters: any = {};
      if (filters.year) invoiceFilters.year = filters.year;
      if (filters.block) invoiceFilters.block = filters.block;
      if (filters.searchTerm) invoiceFilters.searchTerm = filters.searchTerm;
      
      const unpaidInvoices = await invoicesService.getUnpaidInvoices(invoiceFilters);
      
      // Don't filter by category - show all unpaid invoices from all categories
      let filteredInvoices = unpaidInvoices;
      
      // Filter by ownerId if specified
      if (filters.ownerId) {
        const apartmentIdsForOwner = apartments
          .filter(apt => apt.ownerId === filters.ownerId)
          .map(apt => apt.id);
        filteredInvoices = filteredInvoices.filter(inv => apartmentIdsForOwner.includes(inv.apartmentId));
      }
      
      // Ensure all apartments referenced are loaded
      const invoiceApartmentIds = new Set(filteredInvoices.map(inv => inv.apartmentId));
      const allApartmentIds = new Set([...invoiceApartmentIds]);
      const loadedApartmentIds = new Set(apartments.map(a => a.id));
      const missingApartmentIds = Array.from(allApartmentIds).filter(id => !loadedApartmentIds.has(id));
      
      // Fetch missing apartments
      if (missingApartmentIds.length > 0) {
        const missingApartments = await Promise.all(
          missingApartmentIds.map(id => apartmentsService.getApartmentById(id))
        );
        const validMissingApartments = missingApartments.filter(apt => apt !== undefined) as any[];
        apartments.push(...validMissingApartments);
      }
      
      // Build report data from invoices only
      const reportData = CommonExpensesController.buildReportDataFromInvoices(filteredInvoices, apartments, users, categories);
      
      // Filter for unpaid/partial payments only (already filtered in getUnpaidInvoices, but double-check)
      // Exclude credits: items where amountPaid >= amount (fully paid or overpaid)
      // Also exclude items with outstandingAmount <= 0 or negative amounts
      const unpaidData = reportData.filter(item => {
        const invoiceAmount = item.payment.totalAmount || item.invoice.amount || 0;
        const amountPaid = item.payment.amountPaid || item.invoice.amountPaid || 0;
        const outstanding = item.outstandingAmount || (invoiceAmount - amountPaid);
        
        // Exclude credits (overpaid invoices) - where amountPaid >= amount
        if (amountPaid >= invoiceAmount) {
          return false;
        }
        // Exclude negative or zero invoice amounts (invalid invoices)
        if (invoiceAmount <= 0) {
          return false;
        }
        // Exclude negative outstanding amounts (shouldn't happen, but filter just in case)
        if (outstanding <= 0) {
          return false;
        }
        // Only include unpaid or partial with positive outstanding amount
        return (item.paymentStatus === 'unpaid' || item.paymentStatus === 'partial') &&
               outstanding > 0;
      });
      
      console.log('DEBUG: Unpaid/partial invoices and payments:', unpaidData.length);
      
      // Debug: Log payments for c102 and c103 after building report data
      const debugPayments = unpaidData.filter(item => {
        const unitNum = item.apartment?.unitNumberUnofficial || item.apartment?.unitNumberOfficial || 
                       (item.payment as any).apartmentData?.unitNumberUnofficial || 
                       (item.payment as any).apartmentData?.unitNumberOfficial || '';
        const aptId = item.payment.apartmentId;
        return unitNum.toLowerCase().includes('102') || unitNum.toLowerCase().includes('103') ||
               aptId === 102 || aptId === 103;
      });
      console.log('DEBUG: Found payments for c102/c103 in unpaidData:', debugPayments.length);
      if (debugPayments.length > 0) {
        console.log('DEBUG: Payment details:', debugPayments.map(p => ({
          apartmentId: p.payment.apartmentId,
          unitNumber: p.apartment?.unitNumberUnofficial || p.apartment?.unitNumberOfficial || 
                     (p.payment as any).apartmentData?.unitNumberUnofficial || 
                     (p.payment as any).apartmentData?.unitNumberOfficial,
          block: p.apartment?.block || (p.payment as any).apartmentData?.block,
          ownerId: p.apartment?.ownerId || (p.payment as any).apartmentData?.ownerId,
          outstanding: p.outstandingAmount,
          status: p.paymentStatus,
          hasApartment: !!p.apartment,
          hasApartmentData: !!(p.payment as any).apartmentData
        })));
      }
      
      // Apply additional filters
      const filteredData = CommonExpensesController.applyFilters(unpaidData, filters);
      
      console.log('DEBUG: After applying filters:', filteredData.length);
      const debugAfterFilters = filteredData.filter(item => {
        const unitNum = item.apartment?.unitNumberUnofficial || item.apartment?.unitNumberOfficial || 
                       (item.payment as any).apartmentData?.unitNumberUnofficial || 
                       (item.payment as any).apartmentData?.unitNumberOfficial || '';
        const aptId = item.payment.apartmentId;
        return unitNum.toLowerCase().includes('102') || unitNum.toLowerCase().includes('103') ||
               aptId === 102 || aptId === 103;
      });
      console.log('DEBUG: After filters - c102/c103 payments:', debugAfterFilters.length);
      
      // Group data by block, then apartment, then year (filtering out credits - threshold 0 to exclude fully paid/overpaid)
      const groupedData = CommonExpensesController.groupUnpaidDataByBlock(filteredData, 0);
      
      // Filter out apartments with total outstanding <= 0 (fully paid or overpaid/credits)
      const filteredGroupedData = CommonExpensesController.filterApartmentsWithCredits(groupedData);
      
      console.log('DEBUG: Grouped data blocks:', Object.keys(filteredGroupedData));
      if (filteredGroupedData['C']) {
        console.log('DEBUG: Block C apartments:', Object.keys(filteredGroupedData['C']));
        console.log('DEBUG: Block C apartment details:', Object.keys(filteredGroupedData['C']).map(aptId => ({
          apartmentId: aptId,
          unitNumber: filteredGroupedData['C'][aptId].apartment?.unitNumberUnofficial || filteredGroupedData['C'][aptId].apartment?.unitNumberOfficial,
          payments: filteredGroupedData['C'][aptId].payments.length
        })));
      }
      
      // Calculate block-level outstanding totals
      const blockTotals = CommonExpensesController.calculateBlockTotals(filteredGroupedData);
      
      // Calculate summary statistics
      const summary = CommonExpensesController.calculateUnpaidSummary(filteredData);
      
      res.render('common-expenses/unpaid-report', {
        title: 'Unpaid Apartments Report',
        pageTitle: 'Unpaid Apartments by Block',
        pageSubtitle: 'Detailed report of unpaid apartment payments grouped by blocks',
        groupedData: filteredGroupedData,
        blockTotals,
        summary,
        filters,
        reportDate: new Date().toLocaleDateString(),
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error rendering unpaid report:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Group unpaid data by block, apartment, and year
   */
  private static groupUnpaidDataByBlock(data: CommonExpensesData[], outstandingLessThan: number = 0): any {
    const grouped: any = {};
    
    data.forEach(item => {
      // Skip items with outstanding amounts <= 0 (fully paid or overpaid/credits)
      // If threshold is 0, filter out items with outstandingAmount <= 0
      if (item.outstandingAmount <= outstandingLessThan) {
        return;
      }
      
      // Determine block - use apartment block if available, or from payment's apartmentData (from JOIN), otherwise 'Unknown'
      let block = item.apartment?.block || (item.payment as any).apartmentData?.block;
      if (!block) {
        block = 'Unknown';
      }
      
      // Use payment's apartmentId if apartment record is not found to avoid grouping different apartments together
      const apartmentId = item.apartment?.id || item.payment.apartmentId || 'Unknown';
      const year = item.payment.year;
      
      if (!grouped[block]) {
        grouped[block] = {};
      }
      
      if (!grouped[block][apartmentId]) {
        // Create a minimal apartment object if apartment data is missing
        const apartmentData = item.apartment || {
          id: item.payment.apartmentId,
          block: block,
          unitNumberOfficial: `Apartment ${item.payment.apartmentId}`,
          unitNumberUnofficial: null,
          areaInM2: 0,
          ownerId: null
        };
        
        grouped[block][apartmentId] = {
          apartment: apartmentData,
          owner: item.owner,
          payments: []
        };
      }
      
      grouped[block][apartmentId].payments.push({
        year,
        payment: item.payment,
        outstandingAmount: item.outstandingAmount,
        paymentStatus: item.paymentStatus,
        category: item.category // Include category information
      });
    });
    
    return grouped;
  }

  /**
   * Calculate summary statistics for unpaid report
   */
  private static calculateUnpaidSummary(data: CommonExpensesData[]): any {
    const totalOutstanding = data.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const totalApartments = new Set(data.map(item => item.apartment?.id)).size;
    const totalBlocks = new Set(data.map(item => item.apartment?.block)).size;
    const unpaidCount = data.filter(item => item.paymentStatus === 'unpaid').length;
    const partialCount = data.filter(item => item.paymentStatus === 'partial').length;
    
    return {
      totalOutstanding,
      totalApartments,
      totalBlocks,
      unpaidCount,
      partialCount
    };
  }


  /**
   * Filter out apartments with negative total outstanding amounts (credits)
   */
  private static filterApartmentsWithCredits(groupedData: any): any {
    const filteredData: any = {};
    
    Object.keys(groupedData).forEach(block => {
      const blockApartments: any = {};
      
      Object.keys(groupedData[block]).forEach(apartmentId => {
        const apartmentData = groupedData[block][apartmentId];
        
        // Calculate total outstanding amount for this apartment
        const totalOutstanding = apartmentData.payments.reduce((sum: number, payment: any) => 
          sum + payment.outstandingAmount, 0
        );
        
        // Only include apartments with positive outstanding amounts
        if (totalOutstanding > 0) {
          blockApartments[apartmentId] = apartmentData;
        }
      });
      
      // Only include blocks that have apartments
      if (Object.keys(blockApartments).length > 0) {
        filteredData[block] = blockApartments;
      }
    });
    
    return filteredData;
  }

  /**
   * Calculate block-level outstanding totals
   */
  private static calculateBlockTotals(groupedData: any): any {
    const blockTotals: any = {};
    
    Object.keys(groupedData).forEach(block => {
      let blockTotal = 0;
      let apartmentCount = 0;
      
      Object.keys(groupedData[block]).forEach(apartmentId => {
        const apartmentData = groupedData[block][apartmentId];
        apartmentCount++;
        
        apartmentData.payments.forEach((payment: any) => {
          blockTotal += payment.outstandingAmount;
        });
      });
      
      blockTotals[block] = {
        totalOutstanding: blockTotal,
        apartmentCount
      };
    });
    
    return blockTotals;
  }

}

