import { Request, Response } from 'express';
import { SiteSettingsService } from '../services/siteSettingsService';
import { OrderShipmentService } from '../services/orderShipmentService';
import { OrderManagementService } from '../services/orderManagementService';
import { i18nService } from '../services/i18nService';
import { createPickupJson } from '../../src/aramex';
import shippingService from '../../src/services/shippingService';

const siteSettingsService = SiteSettingsService.getInstance();
const shipmentService = OrderShipmentService.getInstance();
const orderService = OrderManagementService.getInstance();

export class ShipmentsController {
  /**
   * Shipments list page: orders that have shipment created (tracking number).
   * Query params: order_number, customer, tracking, pickup_code, shipped (filters). Default: only not shipped. Orders without pickup appear first.
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      const order_number = typeof req.query.order_number === 'string' ? req.query.order_number : undefined;
      const customer = typeof req.query.customer === 'string' ? req.query.customer : undefined;
      const tracking = typeof req.query.tracking === 'string' ? req.query.tracking : undefined;
      const pickup_code = typeof req.query.pickup_code === 'string' ? req.query.pickup_code : undefined;
      const shippedParam = typeof req.query.shipped === 'string' ? req.query.shipped : undefined;
      const shipped = (shippedParam === 'all' || shippedParam === 'shipped' || shippedParam === 'not_shipped')
        ? shippedParam
        : 'not_shipped';
      const filterParams: { order_number?: string; customer?: string; tracking?: string; pickup_code?: string; shipped?: 'all' | 'shipped' | 'not_shipped' } = {};
      if (order_number !== undefined) filterParams.order_number = order_number;
      if (customer !== undefined) filterParams.customer = customer;
      if (tracking !== undefined) filterParams.tracking = tracking;
      if (pickup_code !== undefined) filterParams.pickup_code = pickup_code;
      filterParams.shipped = shipped;
      const rows = await shipmentService.getOrdersWithShipmentCreated(filterParams);
      const siteTitle = await siteSettingsService.getSiteTitle();
      const t = await i18nService.getTranslations(req);
      const csrfToken = (res.locals as any).csrfToken || '';
      res.render('shipments/index', {
        title: 'Shipments',
        pageTitle: typeof t !== 'undefined' ? t('ecommerce.shipments.title') : 'Shipments',
        siteTitle,
        t,
        shipments: rows,
        csrfToken,
        filters: { order_number, customer, tracking, pickup_code, shipped }
      });
    } catch (error) {
      console.error('Error rendering shipments page:', error);
      res.status(500).render('admin/error', { error });
    }
  }

  /**
   * Schedule pickup for selected orders (CreatePickup with ExistingShipments).
   * POST body: orderIds[] (or shipmentIds[]), date, ready_hour, ready_minute, closing_hour, closing_minute, location, vehicle, comments.
   */
  public static async schedulePickup(req: Request, res: Response): Promise<void> {
    try {
      const orderIds = Array.isArray(req.body.orderIds) ? req.body.orderIds.map((id: any) => parseInt(String(id))) : [];
      if (orderIds.length === 0) {
        res.status(400).json({ success: false, error: 'Select at least one order.' });
        return;
      }

      const defaults = await shippingService.getAramexPickupDefaults();
      if (!defaults) {
        res.status(400).json({ success: false, error: 'Aramex is not configured.' });
        return;
      }
      const originEntity = defaults.OriginEntity;
      const existingShipments: Array<{ Number: string; OriginEntity: string; ProductGroup: string }> = [];
      let totalWeight = 0;

      for (const orderId of orderIds) {
        const shipment = await shipmentService.getShipmentByOrderId(orderId);
        if (!shipment?.tracking_number) continue;
        existingShipments.push({
          Number: String(shipment.tracking_number).trim(),
          OriginEntity: originEntity,
          ProductGroup: (shipment.product_group || 'DOM').trim()
        });
        totalWeight += Number(shipment.total_weight) || 0.5;
      }

      if (existingShipments.length === 0) {
        res.status(400).json({ success: false, error: 'No valid shipments found for selected orders.' });
        return;
      }

      const {
        date,
        ready_hour,
        ready_minute,
        closing_hour,
        closing_minute,
        location,
        vehicle,
        comments
      } = req.body;

      const pickupDate = date ? new Date(date) : new Date();
      const readyTime = new Date(pickupDate);
      readyTime.setHours(parseInt(ready_hour || '10', 10), parseInt(ready_minute || '0', 10), 0, 0);
      const closingTime = new Date(pickupDate);
      closingTime.setHours(parseInt(closing_hour || '17', 10), parseInt(closing_minute || '0', 10), 0, 0);

      const pickupBody = {
        LabelInfo: null,
        Pickup: {
          PickupAddress: defaults.PickupAddress,
          PickupContact: defaults.PickupContact,
          PickupLocation: (location || 'Reception').trim(),
          PickupDate: `/Date(${pickupDate.getTime()})/`,
          ReadyTime: `/Date(${readyTime.getTime()})/`,
          LastPickupTime: `/Date(${closingTime.getTime()})/`,
          ClosingTime: `/Date(${closingTime.getTime()})/`,
          Comments: (comments || `Pickup for ${existingShipments.length} shipment(s)`).trim(),
          Reference1: orderIds.join(','),
          Reference2: '',
          Vehicle: (vehicle || '0').trim(),
          Shipments: [],
          PickupItems: [{
            ProductGroup: existingShipments[0]?.ProductGroup || 'DOM',
            ProductType: 'CDS',
            NumberOfShipments: existingShipments.length,
            PackageType: 'Box',
            Payment: 'P',
            ShipmentWeight: { Unit: 'KG', Value: Math.max(0.5, totalWeight) },
            ShipmentVolume: null,
            NumberOfPieces: existingShipments.length,
            CashAmount: null,
            ExtraCharges: null,
            ShipmentDimensions: { Length: 0.1, Width: 0.1, Height: 0.1, Unit: 'cm' },
            Comments: comments || ''
          }],
          Status: 'Ready',
          ExistingShipments: existingShipments,
          Branch: '',
          RouteCode: ''
        },
        Transaction: { Reference1: '', Reference2: '', Reference3: '', Reference4: '', Reference5: '' }
      };

      const result = await createPickupJson(pickupBody);
      if (result.HasErrors) {
        const notifs = result.Notifications as { Notification?: Array<{ Message?: string }> } | undefined;
        const msg = Array.isArray(notifs?.Notification) ? notifs.Notification.map((n) => n?.Message).filter(Boolean).join('; ') : 'Pickup request failed';
        res.status(400).json({ success: false, error: msg });
        return;
      }

      const pickupId = result.ProcessedPickup?.ID ?? result.ProcessedPickup?.Reference1 ?? null;
      const pickupGUID = result.ProcessedPickup?.GUID ?? null;
      if (!pickupId) {
        res.status(500).json({ success: false, error: 'Aramex did not return a pickup reference.' });
        return;
      }

      const readyStr = `${String(ready_hour || 10).padStart(2, '0')}:${String(ready_minute || 0).padStart(2, '0')}:00`;
      const closingStr = `${String(closing_hour || 17).padStart(2, '0')}:${String(closing_minute || 0).padStart(2, '0')}:00`;

      const failedOrderIds: number[] = [];
      for (const orderId of orderIds) {
        try {
          const shipment = await shipmentService.getShipmentByOrderId(orderId);
          if (shipment) {
            await shipmentService.updatePickupDetails(orderId, {
              pickup_reference: pickupId,
              pickup_guid: pickupGUID ?? null,
              pickup_date: pickupDate,
              pickup_ready_time: readyStr,
              pickup_closing_time: closingStr,
              pickup_location: location || 'Reception',
              pickup_vehicle: vehicle || 'Bike',
              product_group: shipment.product_group ?? 'DOM',
              product_type: shipment.product_type ?? 'CDS',
              total_weight: shipment.total_weight ?? 0.5,
              weight_unit: 'kg',
              comments: comments || undefined
            });
          }
          await orderService.updateOrderStatus(orderId, 'shipped', (req.session as any).user?.id, `Aramex pickup scheduled. Ref: ${pickupId}`);
        } catch (err) {
          console.error(`Failed to update order ${orderId} after pickup:`, err);
          failedOrderIds.push(orderId);
        }
      }

      const message =
        failedOrderIds.length === 0
          ? `Pickup scheduled for ${orderIds.length} order(s). Reference: ${pickupId}`
          : `Pickup scheduled. Reference: ${pickupId}. Status could not be updated for order(s): ${failedOrderIds.join(', ')}.`;

      res.json({
        success: true,
        pickupId,
        pickupGUID,
        orderIds,
        failedOrderIds: failedOrderIds.length > 0 ? failedOrderIds : undefined,
        message
      });
    } catch (error) {
      console.error('Error scheduling pickup:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule pickup'
      });
    }
  }
}
