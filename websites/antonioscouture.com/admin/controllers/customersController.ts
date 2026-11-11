import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { CustomerManagementService } from '../services/customerManagementService';
import { i18nService } from '../services/i18nService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const customerService = CustomerManagementService.getInstance();

export class CustomersController {
  /**
   * Customers list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const filters: any = {};
      if (search) filters.search = search;
      if (status) filters.status = status;

      const result = await customerService.getAllCustomers(page, limit, filters);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('customers/customers', {
        title: 'Customers',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.customers.title') : 'Customers',
        siteTitle,
        t,
        customers: result.customers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        filters: { search, status }
      });
    } catch (error) {
      console.error('Error rendering customers page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Customer detail page
   */
  public static async detail(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.id);
      const customer = await customerService.getCustomerById(customerId);

      if (!customer) {
        res.status(404).render('admin/error', { error: 'Customer not found' });
        return;
      }

      const orders = await customerService.getCustomerOrders(customerId);
      const addresses = await customerService.getCustomerAddresses(customerId);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

      res.render('customers/customer-detail', {
        title: `Customer - ${customer.email}`,
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.customers.customerDetail') : `Customer - ${customer.email}`,
        siteTitle,
        t,
        customer,
        orders,
        addresses
      });
    } catch (error) {
      console.error('Error rendering customer detail page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update customer status
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.id);
      const { status } = req.body;

      await customerService.updateCustomerStatus(customerId, status);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating customer status:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update customer status' });
    }
  }
}

