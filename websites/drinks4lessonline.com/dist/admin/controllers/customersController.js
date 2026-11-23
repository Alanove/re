"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const customerManagementService_1 = require("../services/customerManagementService");
const i18nService_1 = require("../services/i18nService");
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const customerService = customerManagementService_1.CustomerManagementService.getInstance();
class CustomersController {
    static async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const search = req.query.search;
            const status = req.query.status;
            const filters = {};
            if (search)
                filters.search = search;
            if (status)
                filters.status = status;
            const result = await customerService.getAllCustomers(page, limit, filters);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
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
        }
        catch (error) {
            console.error('Error rendering customers page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async detail(req, res) {
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
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('customers/customer-detail', {
                title: `Customer - ${customer.email}`,
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.customers.customerDetail') : `Customer - ${customer.email}`,
                siteTitle,
                t,
                customer,
                orders,
                addresses
            });
        }
        catch (error) {
            console.error('Error rendering customer detail page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async updateStatus(req, res) {
        try {
            const customerId = parseInt(req.params.id);
            const { status } = req.body;
            await customerService.updateCustomerStatus(customerId, status);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating customer status:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to update customer status' });
        }
    }
}
exports.CustomersController = CustomersController;
//# sourceMappingURL=customersController.js.map