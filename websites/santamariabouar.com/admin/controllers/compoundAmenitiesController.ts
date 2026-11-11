import { Request, Response } from 'express';
import { CompoundAmenitiesService } from '../services/compoundAmenitiesService';
import { SiteSettingsService } from '../services/siteSettingsService';

const amenitiesService = CompoundAmenitiesService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class CompoundAmenitiesController {
  static async index(req: Request, res: Response): Promise<void> {
    try {
      const [amenities, siteTitle] = await Promise.all([
        amenitiesService.getAllAmenities(),
        siteSettingsService.getSiteTitle()
      ]);

      res.render('compound-amenities/index', {
        title: 'Compound Amenities',
        pageTitle: 'Compound Amenities',
        siteTitle,
        amenities,
        success: req.query.success,
        error: req.query.error
      });
    } catch (error) {
      console.error('Error loading compound amenities:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) {
        res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Name is required.'));
        return;
      }

      await amenitiesService.create({
        name,
        icon: String(req.body.icon || 'bi-star').trim(),
        description: String(req.body.description || '').trim(),
        sortOrder: parseInt(String(req.body.sortOrder || '0'), 10) || 0,
        isActive: req.body.isActive === '1' || req.body.isActive === 'on'
      });

      res.redirect('/admin/compound-amenities?success=' + encodeURIComponent('Amenity added.'));
    } catch (error) {
      console.error('Error creating compound amenity:', error);
      res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Could not add amenity.'));
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      const name = String(req.body.name || '').trim();
      if (!name) {
        res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Name is required.'));
        return;
      }

      const updated = await amenitiesService.update(id, {
        name,
        icon: String(req.body.icon || 'bi-star').trim(),
        description: String(req.body.description || '').trim(),
        sortOrder: parseInt(String(req.body.sortOrder || '0'), 10) || 0,
        isActive: req.body.isActive === '1' || req.body.isActive === 'on'
      });

      if (!updated) {
        res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Amenity not found.'));
        return;
      }

      res.redirect('/admin/compound-amenities?success=' + encodeURIComponent('Amenity updated.'));
    } catch (error) {
      console.error('Error updating compound amenity:', error);
      res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Could not update amenity.'));
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id, 10);
    try {
      await amenitiesService.delete(id);
      res.redirect('/admin/compound-amenities?success=' + encodeURIComponent('Amenity deleted.'));
    } catch (error) {
      console.error('Error deleting compound amenity:', error);
      res.redirect('/admin/compound-amenities?error=' + encodeURIComponent('Could not delete amenity.'));
    }
  }
}
