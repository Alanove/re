import { Request, Response } from 'express';
import { apartmentsService } from '../services/apartmentsService';
import {
  apartmentParkingLabel,
  PARKING_PLAN_IMAGE_URL,
  parkingMapService,
  ParkingMapValidationError
} from '../../src/services/parkingMapService';

export class ParkingMapController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const codes = await apartmentsService.listApartmentCodes();
      const spots = await parkingMapService.getAll();
      const apartments = codes.map((apartment) => ({
        id: apartment.id,
        block: apartment.block,
        unitNumberOfficial: apartment.unitNumberOfficial,
        unitNumberUnofficial: apartment.unitNumberUnofficial,
        label: apartmentParkingLabel(apartment),
        bayCount: (spots[String(apartment.id)] || []).length
      }));

      res.render('parking-map/index', {
        title: 'Parking map',
        pageTitle: 'Parking map',
        pageSubtitle: 'Draw a bay for each apartment',
        user: (req.session as any).user,
        apartments,
        spots,
        imageUrl: PARKING_PLAN_IMAGE_URL,
        showBreadcrumb: false,
        showPageHeader: false
      });
    } catch (error) {
      console.error('Error loading parking map:', error);
      res.status(500).render('admin/error', {
        message: 'Error loading the parking map',
        error
      });
    }
  }

  static async save(req: Request, res: Response): Promise<void> {
    try {
      const apartmentId = parseInt(String(req.body?.apartmentId), 10);
      if (!Number.isFinite(apartmentId)) {
        res.status(400).json({ success: false, message: 'Choose an apartment first.' });
        return;
      }

      const apartment = await apartmentsService.getApartmentCode(apartmentId);
      if (!apartment) {
        res.status(404).json({ success: false, message: 'Apartment not found.' });
        return;
      }

      await parkingMapService.saveForApartment(apartmentId, req.body?.bays);
      const spots = await parkingMapService.getAll();
      res.json({ success: true, bays: spots[String(apartmentId)] || [] });
    } catch (error) {
      if (error instanceof ParkingMapValidationError) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      console.error('Error saving parking bays:', error);
      res.status(500).json({ success: false, message: 'Could not save the parking bay.' });
    }
  }
}
