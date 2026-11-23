import { Request, Response } from 'express';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { OrderManagementService } from '../services/orderManagementService';
import { OrderShipmentService } from '../services/orderShipmentService';
import { i18nService } from '../services/i18nService';
import { requireAdminAccess } from '../utils/roleMiddleware';
import shippingService from '../../src/services/shippingService';

const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();
const orderService = OrderManagementService.getInstance();
const shipmentService = OrderShipmentService.getInstance();

export class OrdersController {
  /**
   * Orders list page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const payment_status = req.query.payment_status as string;
      const payment_type = req.query.payment_type as string;
      const search = req.query.search as string;

      const filters: any = {};
      if (status) filters.status = status;
      if (payment_status) filters.payment_status = payment_status;
      if (payment_type) filters.payment_type = payment_type;
      if (search) filters.search = search;

      const result = await orderService.getAllOrders(page, limit, filters);

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);

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
          payment_type: (req.query.payment_type as string) || '',
          search
        }
      });
    } catch (error) {
      console.error('Error rendering orders page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Order detail page
   */
  public static async detail(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderWithItems(orderId);

      if (!order) {
        res.status(404).render('admin/error', { error: 'Order not found' });
        return;
      }

      const shipment = await shipmentService.getShipmentByOrderId(orderId);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const csrfToken = (res.locals as any).csrfToken || '';
      const success = req.query.success as string | undefined;
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
    } catch (error) {
      console.error('Error rendering order detail page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Update order status (and optionally payment status)
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const { status, payment_status: paymentStatus, notes } = req.body;
      const userId = (req.session as any).user?.id;

      await orderService.updateOrderStatus(orderId, status, userId, notes);
      if (paymentStatus != null && paymentStatus !== '') {
        await orderService.updatePaymentStatus(orderId, paymentStatus);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  }

  /**
   * Update order notes
   */
  public static async updateNotes(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const { internal_notes } = req.body;

      await orderService.updateOrderNotes(orderId, internal_notes);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating order notes:', error);
      res.status(500).json({ error: 'Failed to update order notes' });
    }
  }

  /**
   * Edit cart page (cash on delivery only)
   */
  public static async editCart(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderWithItems(orderId);

      if (!order) {
        res.status(404).render('admin/error', { error: 'Order not found' });
        return;
      }

      if (!orderService.isCashOnDelivery(order)) {
        (req as any).flash?.('error', 'Cart can only be edited for cash on delivery orders.');
        res.redirect(`/admin/orders/${orderId}`);
        return;
      }

      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const csrfToken = (res.locals as any).csrfToken || '';

      res.render('orders/edit-cart', {
        title: `Edit Cart - Order ${order.order_number}`,
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.orders.editCart') : 'Edit Cart',
        siteTitle,
        t,
        order,
        csrfToken
      });
    } catch (error) {
      console.error('Error rendering edit cart page:', error);
      res.status(500).render('admin/error', { error: error instanceof Error ? error.message : 'Server error' });
    }
  }

  /**
   * Update order cart (items and shipping). Cash on delivery only.
   */
  public static async updateCart(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const { items, shipping_amount: shippingAmount } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Invalid items' });
        return;
      }

      const normalized = items.map((it: any) => {
        const entry: { id?: number; product_id: number; variant_id: number | null; quantity: number; unit_price: number } = {
          product_id: parseInt(it.product_id),
          variant_id: it.variant_id != null && it.variant_id !== '' ? parseInt(it.variant_id) : null,
          quantity: parseInt(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0
        };
        if (it.id != null) entry.id = parseInt(it.id);
        return entry;
      }).filter((it: any) => it.quantity > 0 && it.unit_price >= 0);

      await orderService.updateOrderCart(orderId, normalized, shippingAmount != null ? parseFloat(shippingAmount) : undefined);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating order cart:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart'
      });
    }
  }

  /**
   * API: Get products with variants for add-product in edit cart
   */
  public static async getProductsForCart(req: Request, res: Response): Promise<void> {
    try {
      const search = (req.query.q as string) || '';
      const products = await orderService.getProductsWithVariantsForOrder(search);
      res.json(products);
    } catch (error) {
      console.error('Error getting products for cart:', error);
      res.status(500).json([]);
    }
  }

  /**
   * Schedule Aramex pickup for an order. POST /admin/orders/:id/schedule-pickup
   * Body: { date, ready_hour, ready_minute, closing_hour, closing_minute, vehicle, location, 
   *         product_group, product_type, payment_type, number_of_pieces, total_weight, weight_unit, comments }
   */
  public static async schedulePickup(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderWithItems(orderId);

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const {
        date,
        ready_hour,
        ready_minute,
        closing_hour,
        closing_minute,
        vehicle,
        location,
        payment_type,
        number_of_pieces,
        total_weight,
        weight_unit,
        comments
      } = req.body;

      // Auto-determine productGroup/productType based on destination country (LB = DOM/CDS, else = EXP/PPX)
      const shippingAddr = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : (order.shipping_address || {});
      const destCountry = (shippingAddr.country || '').toString().toUpperCase();
      const shipperCountry = 'LB'; // Shipper is always Lebanon
      const isDomestic = destCountry === shipperCountry;
      const productGroup = isDomestic ? 'DOM' : 'EXP';
      const productType = isDomestic ? 'CDS' : 'PPX';

      // Build Date objects from form data
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

      const result = await shippingService.schedulePickupWithExistingShipments(
        [{ trackingNumber: shipment.tracking_number, productGroup: shipment.product_group || productGroup }],
        {
          pickupDate,
          readyTime,
          closingTime,
          location: location || 'Reception',
          vehicle: vehicle || '0',
          comments: comments || `Order #${order.order_number}`,
          reference1: order.order_number
        }
      );

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      const shipmentData: any = {
        pickup_reference: result.pickupId,
        pickup_guid: result.pickupGUID ?? null,
        pickup_date: pickupDate,
        pickup_ready_time: `${ready_hour || '10'}:${ready_minute || '00'}:00`,
        pickup_closing_time: `${closing_hour || '17'}:${closing_minute || '00'}:00`,
        pickup_location: location || 'Reception',
        pickup_vehicle: vehicle || 'Bike',
        product_group: productGroup, // Auto-determined
        product_type: productType,    // Auto-determined
        payment_type: payment_type || 'P',
        weight_unit: weight_unit || 'kg'
      };
      if (number_of_pieces) shipmentData.number_of_pieces = parseInt(number_of_pieces);
      if (total_weight) shipmentData.total_weight = parseFloat(total_weight);
      if (comments) shipmentData.comments = comments;
      
      await shipmentService.updatePickupDetails(orderId, shipmentData);

      await orderService.addOrderNote(
        orderId,
        `Aramex pickup scheduled. Pickup reference: ${result.pickupId}, Date: ${pickupDate.toLocaleDateString()}`,
        true
      );
      res.json({ success: true, pickupId: result.pickupId });
    } catch (error) {
      console.error('Error scheduling pickup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule pickup'
      });
    }
  }

  /**
   * Schedule pickup and generate waybill in one flow. POST /admin/orders/:id/schedule-pickup-and-waybill
   * Body: same as schedule-pickup (date, ready_hour, ready_minute, closing_hour, closing_minute, vehicle, location,
   *       product_group, product_type, payment_type, number_of_pieces, total_weight, weight_unit, number_of_shipments, comments)
   * Order: 1) Create waybill, 2) Schedule pickup. On success returns trackingNumber, labelUrl, pickupId so user can print waybill.
   */
  public static async schedulePickupAndWaybill(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderWithItems(orderId);

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const {
        date,
        ready_hour,
        ready_minute,
        closing_hour,
        closing_minute,
        vehicle,
        location,
        payment_type,
        number_of_pieces,
        total_weight,
        weight_unit,
        number_of_shipments,
        comments
      } = req.body;

      // Auto-determine productGroup/productType based on destination country (LB = DOM/CDS, else = EXP/PPX)
      const shippingAddr = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : (order.shipping_address || {});
      const destCountry = (shippingAddr.country || '').toString().toUpperCase();
      // Shipper country is always LB (Lebanon) per your setup
      const shipperCountry = 'LB';
      const isDomestic = destCountry === shipperCountry;
      const productGroup = isDomestic ? 'DOM' : 'EXP';
      const productType = isDomestic ? 'CDS' : 'PPX';

      const pickupDate = date ? new Date(date) : new Date();
      const readyTime = new Date(pickupDate);
      readyTime.setHours(parseInt(ready_hour || '10'), parseInt(ready_minute || '0'), 0, 0);
      const closingTime = new Date(pickupDate);
      closingTime.setHours(parseInt(closing_hour || '17'), parseInt(closing_minute || '0'), 0, 0);

      const pickupOptions: any = {
        pickupDate,
        readyTime,
        closingTime,
        location: location || 'Reception',
        vehicle: vehicle || '0',
        productGroup, // Auto-determined from destination country
        productType,   // Auto-determined from destination country
        paymentType: payment_type || 'P',
        weightUnit: weight_unit || 'kg',
        comments: comments || `Order #${order.order_number}`
      };
      if (number_of_pieces) pickupOptions.numberOfPieces = parseInt(number_of_pieces);
      if (total_weight) pickupOptions.weight = parseFloat(total_weight);
      if (number_of_shipments) pickupOptions.numberOfShipments = parseInt(number_of_shipments);

      // 1) Generate waybill first
      const waybillResult = await shippingService.createShipmentForOrder({
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

      // Save tracking
      await shipmentService.updateTrackingDetails(orderId, {
        tracking_number: waybillResult.shipmentId,
        waybill_label_url: waybillResult.labelUrl,
        description_of_goods: `Order #${order.order_number}`
      });
      await orderService.updateOrderTracking(orderId, waybillResult.shipmentId, waybillResult.labelUrl);
      await orderService.addOrderNote(
        orderId,
        `Aramex waybill created. Tracking: ${waybillResult.shipmentId}`,
        true
      );

      // 2) Schedule pickup (JSON API with ExistingShipments)
      const shipmentForPickup = await shipmentService.getShipmentByOrderId(orderId);
      const pickupResult = shipmentForPickup?.tracking_number
        ? await shippingService.schedulePickupWithExistingShipments(
            [{ trackingNumber: shipmentForPickup.tracking_number, productGroup: shipmentForPickup.product_group || productGroup }],
            {
              pickupDate,
              readyTime,
              closingTime,
              location: location || 'Reception',
              vehicle: vehicle || '0',
              comments: comments || `Order #${order.order_number}`,
              reference1: order.order_number
            }
          )
        : { success: false as const, error: 'Shipment not found after waybill creation.' };

      let pickupFailed = false;
      if (pickupResult.success) {
        const shipmentData: any = {
          pickup_reference: pickupResult.pickupId,
          pickup_guid: pickupResult.pickupGUID,
          pickup_date: pickupDate,
          pickup_ready_time: `${ready_hour || '10'}:${ready_minute || '00'}:00`,
          pickup_closing_time: `${closing_hour || '17'}:${closing_minute || '00'}:00`,
          pickup_location: location || 'Reception',
          pickup_vehicle: vehicle || 'Bike',
          product_group: productGroup, // Auto-determined
          product_type: productType,    // Auto-determined
          payment_type: payment_type || 'P',
          weight_unit: weight_unit || 'kg'
        };
        if (number_of_pieces) shipmentData.number_of_pieces = parseInt(number_of_pieces);
        if (total_weight) shipmentData.total_weight = parseFloat(total_weight);
        if (comments) shipmentData.comments = comments;
        await shipmentService.updatePickupDetails(orderId, shipmentData);
        await orderService.addOrderNote(
          orderId,
          `Aramex pickup scheduled. Pickup reference: ${pickupResult.pickupId}, Date: ${pickupDate.toLocaleDateString()}`,
          true
        );
      } else {
        pickupFailed = true;
        await orderService.addOrderNote(
          orderId,
          `Aramex waybill created (Tracking: ${waybillResult.shipmentId}). Pickup scheduling failed: ${pickupResult.error}`,
          true
        );
      }

      res.json({
        success: true,
        trackingNumber: waybillResult.shipmentId,
        labelUrl: waybillResult.labelUrl,
        pickupId: pickupResult.success ? pickupResult.pickupId : null,
        pickupFailed
      });
    } catch (error) {
      console.error('Error in schedulePickupAndWaybill:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule pickup and create waybill'
      });
    }
  }

  /**
   * Create Aramex shipment (generate waybill) for an order. POST /admin/orders/:id/create-waybill
   */
  public static async createWaybill(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderWithItems(orderId);

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const result = await shippingService.createShipmentForOrder({
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

      // Save to order_shipments table (tracking, label URL, full API response, product group/type)
      await shipmentService.updateTrackingDetails(orderId, {
        tracking_number: result.shipmentId,
        waybill_label_url: result.labelUrl ?? null,
        description_of_goods: `Order #${order.order_number}`,
        create_shipment_response: result.rawResponse,
        product_group: result.productGroup,
        product_type: result.productType
      });

      // Also update orders table for backward compatibility
      await orderService.updateOrderTracking(orderId, result.shipmentId, result.labelUrl);
      
      await orderService.addOrderNote(
        orderId,
        `Aramex waybill created. Tracking: ${result.shipmentId}`,
        true
      );
      res.json({
        success: true,
        trackingNumber: result.shipmentId,
        labelUrl: result.labelUrl,
        requestPayload: result.requestPayload,
        testPayload: result.testPayload,
        apiUrl: result.apiUrl
      });
    } catch (error) {
      console.error('Error creating waybill:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create waybill'
      });
    }
  }

  /**
   * Get waybill label URL for printing. When shipment has waybill_label_url (from CreateShipments), return it;
   * otherwise fall back to Aramex PrintLabel for legacy orders.
   */
  public static async printWaybill(req: Request, res: Response): Promise<void> {
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

      const tracking = (order as any).tracking_number ?? shipment?.tracking_number ?? null;
      if (!tracking) {
        res.status(400).json({ success: false, error: 'No waybill. Create shipment first.' });
        return;
      }

      const result = await shippingService.getWaybillLabelForOrder({
        order_number: order.order_number,
        tracking_number: tracking
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, labelUrl: result.labelUrl });
    } catch (error) {
      console.error('Error printing waybill:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get waybill'
      });
    }
  }
}

