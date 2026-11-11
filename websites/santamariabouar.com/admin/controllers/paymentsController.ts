import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { PaymentsService } from '../services/paymentsService';
import { InvoicesService } from '../services/invoicesService';
import { ApartmentsService } from '../services/apartmentsService';

const menuService = AdminMenuService.getInstance();
const paymentsService = PaymentsService.getInstance();
const invoicesService = InvoicesService.getInstance();
const apartmentsService = ApartmentsService.getInstance();

export class PaymentsController {
  /**
   * Render payments page
   */
  public static async payments(req: Request, res: Response): Promise<void> {
    try {
      // Get all price per meter entries
      const pricePerMeter = await paymentsService.getAllPricePerMeter();
      
      // Get payment statistics
      const paymentStats = await paymentsService.getPaymentStats();
      const yearlyInterestRate = await paymentsService.getYearlyInterestRate();
      const currentYear = new Date().getFullYear();
      const interestYears = Array.from(new Set([
        ...pricePerMeter.map(entry => entry.year),
        ...Array.from({ length: 7 }, (_, i) => currentYear - 5 + i)
      ]))
        .filter(year => year > 0)
        .sort((a, b) => b - a);
      
      res.render('payments/payments', {
        title: 'Payments',
        pageTitle: 'Payments Management',
        pageSubtitle: 'Manage price per meter and payment settings',
        pricePerMeter,
        paymentStats,
        yearlyInterestRate,
        interestYears,
        currentYear,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error rendering payments page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Add or update price per meter for a year
   */
  public static async setPriceForYear(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year, price } = req.body;
      
      // Validate input
      if (!year || !price || isNaN(parseInt(year)) || isNaN(parseFloat(price))) {
        return res.redirect('/admin/payments?error=Invalid year or price');
      }
      
      const yearNum = parseInt(year);
      const priceNum = parseFloat(price);
      
      if (yearNum < 1900 || yearNum > 2100) {
        return res.redirect('/admin/payments?error=Year must be between 1900 and 2100');
      }
      
      if (priceNum < 0) {
        return res.redirect('/admin/payments?error=Price cannot be negative');
      }
      
      // Set price for year
      const success = await paymentsService.setPriceForYear(yearNum, priceNum);
      
      if (success) {
        res.redirect('/admin/payments?success=Price per meter updated successfully');
      } else {
        res.redirect('/admin/payments?error=Failed to update price per meter');
      }
    } catch (error) {
      console.error('Error setting price for year:', error);
      res.redirect('/admin/payments?error=Failed to update price per meter');
    }
  }

  /**
   * Delete price per meter for a year
   */
  public static async deletePriceForYear(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year } = req.params;
      
      if (!year || isNaN(parseInt(year))) {
        return res.status(400).json({ success: false, error: 'Invalid year' });
      }
      
      const yearNum = parseInt(year);
      const success = await paymentsService.deletePriceForYear(yearNum);
      
      if (success) {
        res.json({ success: true, message: 'Price per meter deleted successfully' });
      } else {
        res.status(404).json({ success: false, error: 'Price entry not found' });
      }
    } catch (error) {
      console.error('Error deleting price for year:', error);
      res.status(500).json({ success: false, error: 'Failed to delete price per meter' });
    }
  }

  /**
   * Get price per meter data for AJAX requests
   */
  public static async getPriceData(req: Request, res: Response): Promise<void> {
    try {
      const pricePerMeter = await paymentsService.getAllPricePerMeter();
      const paymentStats = await paymentsService.getPaymentStats();
      
      res.json({
        success: true,
        pricePerMeter,
        paymentStats
      });
    } catch (error) {
      console.error('Error getting price data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get price data'
      });
    }
  }

  /**
   * Generate apartment payments for a specific year
   */
  public static async generatePaymentsForYear(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year } = req.body;
      
      if (!year || isNaN(parseInt(year))) {
        return res.status(400).json({ success: false, error: 'Invalid year' });
      }
      
      const yearNum = parseInt(year);
      
      // Ensure at least one sold apartment exists (not_sold are excluded from generation)
      const apartments = (await apartmentsService.getAllApartments())
        .filter(apt => apt.status !== 'not_sold');
      
      if (apartments.length === 0) {
        return res.status(400).json({ success: false, error: 'No sold apartments found' });
      }
      
      // Generate invoices for the year (replaces apartment_payments)
      const result = await invoicesService.createCommonExpenseInvoices(yearNum);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: result.message,
          newPaymentsCount: result.newInvoicesCount
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.message
        });
      }
    } catch (error) {
      console.error('Error generating payments for year:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate payments'
      });
    }
  }
  /**
   * Simulate payments for a year
   */
  public static async simulatePayments(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year } = req.body;
      
      if (!year || isNaN(parseInt(year))) {
        return res.status(400).json({ success: false, error: 'Invalid year' });
      }
      
      const yearNum = parseInt(year);
      
      // Get price for the year
      const pricePerMeter = await paymentsService.getPriceForYear(yearNum);
      
      if (pricePerMeter === null) {
        return res.status(404).json({ success: false, error: 'Price not set for this year' });
      }
      
      // Get sold apartments only (exclude not_sold from payment generation)
      const apartments = (await apartmentsService.getAllApartments())
        .filter(apt => apt.status !== 'not_sold');
      
      // Get existing invoices for the year to see what's already generated
      const existingInvoices = await invoicesService.getCommonExpenseInvoices(yearNum);
      const existingApartmentIds = new Set(existingInvoices.map(inv => inv.apartmentId));
      
      const { onlyMissing } = req.body;
      
      if (apartments.length === 0) {
        return res.json({ success: true, simulation: [] });
      }
      
      // Group by block
      const simulationByBlock: {
        [key: string]: {
          block: string;
          totalArea: number;
          totalAmount: number;
          apartments: Array<{
            id: number;
            unitNumber: string;
            unitNumberUnofficial: string;
            block: string;
            ownerName: string;
            area: number;
            amount: number;
            exists: boolean;
          }>;
        }
      } = {};
      
      apartments.forEach(apt => {
        const block = apt.block || 'Unassigned';
        const exists = existingApartmentIds.has(apt.id);
        
        if (onlyMissing && exists) return;
        
        if (!simulationByBlock[block]) {
          simulationByBlock[block] = {
            block,
            totalArea: 0,
            totalAmount: 0,
            apartments: []
          };
        }
        
        const area = apt.areaInM2 || 0;
        const fullYearAmount = area * pricePerMeter;
        
        let monthsToCharge = 12;
        if (apt.registrationDate) {
          const regDate = new Date(apt.registrationDate);
          const regYear = regDate.getFullYear();
          const regMonth = regDate.getMonth();
          
          if (regYear > yearNum) {
            monthsToCharge = 0;
          } else if (regYear === yearNum) {
            monthsToCharge = 12 - regMonth;
          }
        }
        
        const amount = (fullYearAmount / 12) * monthsToCharge;
        
        if (amount <= 0 && !exists) return; // Don't show in simulation if no amount to charge and doesn't exist
        
        simulationByBlock[block].totalArea += area;
        simulationByBlock[block].totalAmount += amount;
        
        simulationByBlock[block].apartments.push({
          id: apt.id,
          unitNumber: apt.unitNumberOfficial,
          unitNumberUnofficial: apt.unitNumberUnofficial,
          block: apt.block,
          ownerName: apt.ownerName || 'Unknown',
          area,
          amount,
          exists
        });
      });
      
      // Convert to array and sort by block
      const simulation = Object.values(simulationByBlock).sort((a, b) => a.block.localeCompare(b.block));
      
      res.json({
        success: true,
        year: yearNum,
        pricePerMeter,
        simulation
      });
      
    } catch (error) {
      console.error('Error simulating payments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to simulate payments'
      });
    }
  }

  /**
   * Save the global yearly interest rate
   */
  public static async setYearlyInterestRate(req: Request, res: Response): Promise<Response | void> {
    try {
      const { rate } = req.body;

      if (rate === undefined || rate === null || isNaN(parseFloat(rate))) {
        return res.redirect('/admin/payments?error=Invalid interest rate');
      }

      const rateNum = parseFloat(rate);
      if (rateNum < 0 || rateNum > 100) {
        return res.redirect('/admin/payments?error=Interest rate must be between 0 and 100');
      }

      const success = await paymentsService.setYearlyInterestRate(rateNum);
      if (success) {
        res.redirect('/admin/payments?success=Yearly interest rate updated successfully');
      } else {
        res.redirect('/admin/payments?error=Failed to update yearly interest rate');
      }
    } catch (error) {
      console.error('Error setting yearly interest rate:', error);
      res.redirect('/admin/payments?error=Failed to update yearly interest rate');
    }
  }

  /**
   * Simulate interest invoices for a year
   */
  public static async simulateInterest(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year, onlyMissing } = req.body;

      if (!year || isNaN(parseInt(year))) {
        return res.status(400).json({ success: false, error: 'Invalid year' });
      }

      const yearNum = parseInt(year, 10);
      const result = await invoicesService.simulateInterestInvoices(yearNum, Boolean(onlyMissing));

      res.json({
        success: true,
        year: result.year,
        rate: result.rate,
        simulation: result.simulation
      });
    } catch (error) {
      console.error('Error simulating interest invoices:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to simulate interest invoices'
      });
    }
  }

  /**
   * Generate interest invoices for a year
   */
  public static async generateInterest(req: Request, res: Response): Promise<Response | void> {
    try {
      const { year } = req.body;

      if (!year || isNaN(parseInt(year))) {
        return res.status(400).json({ success: false, error: 'Invalid year' });
      }

      const yearNum = parseInt(year, 10);
      const apartments = (await apartmentsService.getAllApartments())
        .filter(apt => apt.status !== 'not_sold');

      if (apartments.length === 0) {
        return res.status(400).json({ success: false, error: 'No sold apartments found' });
      }

      const result = await invoicesService.createInterestInvoices(yearNum);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          newPaymentsCount: result.newInvoicesCount
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Error generating interest invoices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate interest invoices'
      });
    }
  }
}
