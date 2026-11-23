"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const adminMenuService_1 = require("../services/adminMenuService");
const siteSettingsService_1 = require("../services/siteSettingsService");
const orderManagementService_1 = require("../services/orderManagementService");
const orderShipmentService_1 = require("../services/orderShipmentService");
const i18nService_1 = require("../services/i18nService");
const shippingService_1 = __importDefault(require("../../src/services/shippingService"));
const menuService = adminMenuService_1.AdminMenuService.getInstance();
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const orderService = orderManagementService_1.OrderManagementService.getInstance();
const shipmentService = orderShipmentService_1.OrderShipmentService.getInstance();
class OrdersController {
    static async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const status = req.query.status;
            const payment_status = req.query.payment_status;
            const payment_type = req.query.payment_type;
            const search = req.query.search;
            const filters = {};
            if (status)
                filters.status = status;
            if (payment_status)
                filters.payment_status = payment_status;
            if (payment_type)
                filters.payment_type = payment_type;
            if (search)
                filters.search = search;
            const result = await orderService.getAllOrders(page, limit, filters);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            res.render('orders/orders', {
                title: 'Orders',
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.orders.title') : 'Orders',
                siteTitle,
                t,
                orders: result.orders,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages
                },
                filters: {
                    status,
                    payment_status,
                    payment_type: req.query.payment_type || '',
                    search
                }
            });
        }
        catch (error) {
            console.error('Error rendering orders page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async detail(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).render('admin/error', { error: 'Order not found' });
                return;
            }
            const shipment = await shipmentService.getShipmentByOrderId(orderId);
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const csrfToken = res.locals.csrfToken || '';
            const success = req.query.success;
            const canEditCart = orderService.isCashOnDelivery(order);
            res.render('orders/order-detail', {
                title: `Order ${order.order_number}`,
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.orders.orderDetail') : `Order ${order.order_number}`,
                siteTitle,
                t,
                order,
                shipment,
                csrfToken,
                success,
                canEditCart
            });
        }
        catch (error) {
            console.error('Error rendering order detail page:', error);
            res.status(500).render('admin/error', { error });
        }
    }
    static async updateStatus(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const { status, payment_status: paymentStatus, notes } = req.body;
            const userId = req.session.user?.id;
            await orderService.updateOrderStatus(orderId, status, userId, notes);
            if (paymentStatus != null && paymentStatus !== '') {
                await orderService.updatePaymentStatus(orderId, paymentStatus);
            }
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ error: 'Failed to update order status' });
        }
    }
    static async updateNotes(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const { internal_notes } = req.body;
            await orderService.updateOrderNotes(orderId, internal_notes);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating order notes:', error);
            res.status(500).json({ error: 'Failed to update order notes' });
        }
    }
    static async editCart(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).render('admin/error', { error: 'Order not found' });
                return;
            }
            if (!orderService.isCashOnDelivery(order)) {
                req.flash?.('error', 'Cart can only be edited for cash on delivery orders.');
                res.redirect(`/admin/orders/${orderId}`);
                return;
            }
            const siteTitle = await siteSettingsService.getSiteTitle();
            const t = await i18nService_1.i18nService.getTranslations(req);
            const csrfToken = res.locals.csrfToken || '';
            res.render('orders/edit-cart', {
                title: `Edit Cart - Order ${order.order_number}`,
                pageTitle: typeof t !== 'undefined' ? t('ecommerce.orders.editCart') : 'Edit Cart',
                siteTitle,
                t,
                order,
                csrfToken
            });
        }
        catch (error) {
            console.error('Error rendering edit cart page:', error);
            res.status(500).render('admin/error', { error: error instanceof Error ? error.message : 'Server error' });
        }
    }
    static async updateCart(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const { items, shipping_amount: shippingAmount } = req.body;
            if (!Array.isArray(items)) {
                res.status(400).json({ success: false, error: 'Invalid items' });
                return;
            }
            const normalized = items.map((it) => {
                const entry = {
                    product_id: parseInt(it.product_id),
                    variant_id: it.variant_id != null && it.variant_id !== '' ? parseInt(it.variant_id) : null,
                    quantity: parseInt(it.quantity) || 1,
                    unit_price: parseFloat(it.unit_price) || 0
                };
                if (it.id != null)
                    entry.id = parseInt(it.id);
                return entry;
            }).filter((it) => it.quantity > 0 && it.unit_price >= 0);
            await orderService.updateOrderCart(orderId, normalized, shippingAmount != null ? parseFloat(shippingAmount) : undefined);
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error updating order cart:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update cart'
            });
        }
    }
    static async getProductsForCart(req, res) {
        try {
            const search = req.query.q || '';
            const products = await orderService.getProductsWithVariantsForOrder(search);
            res.json(products);
        }
        catch (error) {
            console.error('Error getting products for cart:', error);
            res.status(500).json([]);
        }
    }
    static async schedulePickup(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).json({ success: false, error: 'Order not found' });
                return;
            }
            const { date, ready_hour, ready_minute, closing_hour, closing_minute, vehicle, location, payment_type, number_of_pieces, total_weight, weight_unit, comments } = req.body;
            const shippingAddr = typeof order.shipping_address === 'string'
                ? JSON.parse(order.shipping_address)
                : (order.shipping_address || {});
            const destCountry = (shippingAddr.country || '').toString().toUpperCase();
            const shipperCountry = 'LB';
            const isDomestic = destCountry === shipperCountry;
            const productGroup = isDomestic ? 'DOM' : 'EXP';
            const productType = isDomestic ? 'CDS' : 'PPX';
            const pickupDate = date ? new Date(date) : new Date();
            const readyTime = new Date(pickupDate);
            readyTime.setHours(parseInt(ready_hour || '10'), parseInt(ready_minute || '0'), 0, 0);
            const closingTime = new Date(pickupDate);
            closingTime.setHours(parseInt(closing_hour || '17'), parseInt(closing_minute || '0'), 0, 0);
            const shipment = await shipmentService.getShipmentByOrderId(orderId);
            if (!shipment?.tracking_number?.trim()) {
                res.status(400).json({ success: false, error: 'Create shipment (waybill) first. Use Create Shipment on this order, then schedule pickup from Shipments page or retry here.' });
                return;
            }
            const result = await shippingService_1.default.schedulePickupWithExistingShipments([{ trackingNumber: shipment.tracking_number, productGroup: shipment.product_group || productGroup }], {
                pickupDate,
                readyTime,
                closingTime,
                location: location || 'Reception',
                vehicle: vehicle || '0',
                comments: comments || `Order #${order.order_number}`,
                reference1: order.order_number
            });
            if (!result.success) {
                res.status(400).json({ success: false, error: result.error });
                return;
            }
            const shipmentData = {
                pickup_reference: result.pickupId,
                pickup_guid: result.pickupGUID ?? null,
                pickup_date: pickupDate,
                pickup_ready_time: `${ready_hour || '10'}:${ready_minute || '00'}:00`,
                pickup_closing_time: `${closing_hour || '17'}:${closing_minute || '00'}:00`,
                pickup_location: location || 'Reception',
                pickup_vehicle: vehicle || 'Bike',
                product_group: productGroup,
                product_type: productType,
                payment_type: payment_type || 'P',
                weight_unit: weight_unit || 'kg'
            };
            if (number_of_pieces)
                shipmentData.number_of_pieces = parseInt(number_of_pieces);
            if (total_weight)
                shipmentData.total_weight = parseFloat(total_weight);
            if (comments)
                shipmentData.comments = comments;
            await shipmentService.updatePickupDetails(orderId, shipmentData);
            await orderService.addOrderNote(orderId, `Aramex pickup scheduled. Pickup reference: ${result.pickupId}, Date: ${pickupDate.toLocaleDateString()}`, true);
            res.json({ success: true, pickupId: result.pickupId });
        }
        catch (error) {
            console.error('Error scheduling pickup:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to schedule pickup'
            });
        }
    }
    static async schedulePickupAndWaybill(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).json({ success: false, error: 'Order not found' });
                return;
            }
            const { date, ready_hour, ready_minute, closing_hour, closing_minute, vehicle, location, payment_type, number_of_pieces, total_weight, weight_unit, number_of_shipments, comments } = req.body;
            const shippingAddr = typeof order.shipping_address === 'string'
                ? JSON.parse(order.shipping_address)
                : (order.shipping_address || {});
            const destCountry = (shippingAddr.country || '').toString().toUpperCase();
            const shipperCountry = 'LB';
            const isDomestic = destCountry === shipperCountry;
            const productGroup = isDomestic ? 'DOM' : 'EXP';
            const productType = isDomestic ? 'CDS' : 'PPX';
            const pickupDate = date ? new Date(date) : new Date();
            const readyTime = new Date(pickupDate);
            readyTime.setHours(parseInt(ready_hour || '10'), parseInt(ready_minute || '0'), 0, 0);
            const closingTime = new Date(pickupDate);
            closingTime.setHours(parseInt(closing_hour || '17'), parseInt(closing_minute || '0'), 0, 0);
            const pickupOptions = {
                pickupDate,
                readyTime,
                closingTime,
                location: location || 'Reception',
                vehicle: vehicle || '0',
                productGroup,
                productType,
                paymentType: payment_type || 'P',
                weightUnit: weight_unit || 'kg',
                comments: comments || `Order #${order.order_number}`
            };
            if (number_of_pieces)
                pickupOptions.numberOfPieces = parseInt(number_of_pieces);
            if (total_weight)
                pickupOptions.weight = parseFloat(total_weight);
            if (number_of_shipments)
                pickupOptions.numberOfShipments = parseInt(number_of_shipments);
            const waybillResult = await shippingService_1.default.createShipmentForOrder({
                order_number: order.order_number,
                shipping_address: order.shipping_address,
                items: (order.items || []).map((i) => ({
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price
                })),
                total_amount: order.total_amount,
                payment_method: order.payment_method,
                currency: order.currency
            });
            if (!waybillResult.success) {
                res.status(400).json({
                    success: false,
                    error: waybillResult.error,
                    debug: waybillResult.debug
                });
                return;
            }
            await shipmentService.updateTrackingDetails(orderId, {
                tracking_number: waybillResult.shipmentId,
                waybill_label_url: waybillResult.labelUrl,
                description_of_goods: `Order #${order.order_number}`
            });
            await orderService.updateOrderTracking(orderId, waybillResult.shipmentId, waybillResult.labelUrl);
            await orderService.addOrderNote(orderId, `Aramex waybill created. Tracking: ${waybillResult.shipmentId}`, true);
            const shipmentForPickup = await shipmentService.getShipmentByOrderId(orderId);
            const pickupResult = shipmentForPickup?.tracking_number
                ? await shippingService_1.default.schedulePickupWithExistingShipments([{ trackingNumber: shipmentForPickup.tracking_number, productGroup: shipmentForPickup.product_group || productGroup }], {
                    pickupDate,
                    readyTime,
                    closingTime,
                    location: location || 'Reception',
                    vehicle: vehicle || '0',
                    comments: comments || `Order #${order.order_number}`,
                    reference1: order.order_number
                })
                : { success: false, error: 'Shipment not found after waybill creation.' };
            let pickupFailed = false;
            if (pickupResult.success) {
                const shipmentData = {
                    pickup_reference: pickupResult.pickupId,
                    pickup_guid: pickupResult.pickupGUID,
                    pickup_date: pickupDate,
                    pickup_ready_time: `${ready_hour || '10'}:${ready_minute || '00'}:00`,
                    pickup_closing_time: `${closing_hour || '17'}:${closing_minute || '00'}:00`,
                    pickup_location: location || 'Reception',
                    pickup_vehicle: vehicle || 'Bike',
                    product_group: productGroup,
                    product_type: productType,
                    payment_type: payment_type || 'P',
                    weight_unit: weight_unit || 'kg'
                };
                if (number_of_pieces)
                    shipmentData.number_of_pieces = parseInt(number_of_pieces);
                if (total_weight)
                    shipmentData.total_weight = parseFloat(total_weight);
                if (comments)
                    shipmentData.comments = comments;
                await shipmentService.updatePickupDetails(orderId, shipmentData);
                await orderService.addOrderNote(orderId, `Aramex pickup scheduled. Pickup reference: ${pickupResult.pickupId}, Date: ${pickupDate.toLocaleDateString()}`, true);
            }
            else {
                pickupFailed = true;
                await orderService.addOrderNote(orderId, `Aramex waybill created (Tracking: ${waybillResult.shipmentId}). Pickup scheduling failed: ${pickupResult.error}`, true);
            }
            res.json({
                success: true,
                trackingNumber: waybillResult.shipmentId,
                labelUrl: waybillResult.labelUrl,
                pickupId: pickupResult.success ? pickupResult.pickupId : null,
                pickupFailed
            });
        }
        catch (error) {
            console.error('Error in schedulePickupAndWaybill:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to schedule pickup and create waybill'
            });
        }
    }
    static async createWaybill(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).json({ success: false, error: 'Order not found' });
                return;
            }
            const result = await shippingService_1.default.createShipmentForOrder({
                order_number: order.order_number,
                shipping_address: order.shipping_address,
                items: (order.items || []).map((i) => ({
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price
                })),
                total_amount: order.total_amount,
                payment_method: order.payment_method,
                currency: order.currency
            });
            if (!result.success) {
                console.error('Create waybill failed for order', orderId, ':', result.error, result.debug ? '(debug: errorMessages/rawResponse)' : '');
                res.status(400).json({
                    success: false,
                    error: result.error,
                    debug: result.debug,
                    requestPayload: result.requestPayload,
                    testPayload: result.testPayload,
                    apiUrl: result.apiUrl
                });
                return;
            }
            await shipmentService.updateTrackingDetails(orderId, {
                tracking_number: result.shipmentId,
                waybill_label_url: result.labelUrl ?? null,
                description_of_goods: `Order #${order.order_number}`,
                create_shipment_response: result.rawResponse,
                product_group: result.productGroup,
                product_type: result.productType
            });
            await orderService.updateOrderTracking(orderId, result.shipmentId, result.labelUrl);
            await orderService.addOrderNote(orderId, `Aramex waybill created. Tracking: ${result.shipmentId}`, true);
            res.json({
                success: true,
                trackingNumber: result.shipmentId,
                labelUrl: result.labelUrl,
                requestPayload: result.requestPayload,
                testPayload: result.testPayload,
                apiUrl: result.apiUrl
            });
        }
        catch (error) {
            console.error('Error creating waybill:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create waybill'
            });
        }
    }
    static async printWaybill(req, res) {
        try {
            const orderId = parseInt(req.params.id);
            const order = await orderService.getOrderWithItems(orderId);
            if (!order) {
                res.status(404).json({ success: false, error: 'Order not found' });
                return;
            }
            const shipment = await shipmentService.getShipmentByOrderId(orderId);
            if (shipment?.waybill_label_url) {
                res.json({ success: true, labelUrl: shipment.waybill_label_url });
                return;
            }
            const tracking = order.tracking_number ?? shipment?.tracking_number ?? null;
            if (!tracking) {
                res.status(400).json({ success: false, error: 'No waybill. Create shipment first.' });
                return;
            }
            const result = await shippingService_1.default.getWaybillLabelForOrder({
                order_number: order.order_number,
                tracking_number: tracking
            });
            if (!result.success) {
                res.status(400).json({ success: false, error: result.error });
                return;
            }
            res.json({ success: true, labelUrl: result.labelUrl });
        }
        catch (error) {
            console.error('Error printing waybill:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get waybill'
            });
        }
    }
}
exports.OrdersController = OrdersController;
//# sourceMappingURL=ordersController.js.map