import { Request, Response } from 'express';
import { TestimonialsService } from '../services/testimonialsService';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';

const testimonialsService = TestimonialsService.getInstance();
const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

export class TestimonialsController {
  public static async list(req: Request, res: Response): Promise<void> {
    menuService.setActiveMenuItem('/admin/testimonials');
    res.render('testimonials/testimonials', {
      title: 'Testimonials',
      pageTitle: 'Testimonials',
      pageSubtitle: 'Manage client reviews shown on the home and testimonials pages',
      items: testimonialsService.getAll(),
      siteTitle: siteSettingsService.getSiteTitle(),
      success: req.query['success'],
      error: req.query['error']
    });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    menuService.setActiveMenuItem('/admin/testimonials');
    res.render('testimonials/edit-testimonial', {
      title: 'Add Testimonial',
      pageTitle: 'Add Testimonial',
      pageSubtitle: 'Add a client review',
      item: testimonialsService.getEmpty(),
      isCreateMode: true,
      siteTitle: siteSettingsService.getSiteTitle()
    });
  }

  public static async createPost(req: Request, res: Response): Promise<void> {
    try {
      testimonialsService.create({
        name: (req.body.name || '').trim(),
        quote: (req.body.quote || '').trim(),
        location: (req.body.location || '').trim(),
        rating: parseInt(req.body.rating, 10) || 5,
        sort: parseInt(req.body.sort, 10) || 1000,
        status: req.body.isActive ? 'published' : 'draft'
      });
      res.redirect('/admin/testimonials?success=Testimonial added');
    } catch (error: any) {
      res.render('testimonials/edit-testimonial', {
        title: 'Add Testimonial',
        pageTitle: 'Add Testimonial',
        pageSubtitle: 'Add a client review',
        item: { ...testimonialsService.getEmpty(), ...req.body },
        isCreateMode: true,
        error: error.message || 'Unable to save testimonial',
        siteTitle: siteSettingsService.getSiteTitle()
      });
    }
  }

  public static async edit(req: Request, res: Response): Promise<void> {
    const item = testimonialsService.getById(String(req.params['id'] || ''));
    if (!item) {
      res.redirect('/admin/testimonials?error=Testimonial not found');
      return;
    }
    menuService.setActiveMenuItem('/admin/testimonials');
    res.render('testimonials/edit-testimonial', {
      title: 'Edit Testimonial',
      pageTitle: 'Edit Testimonial',
      pageSubtitle: 'Update this client review',
      item,
      isCreateMode: false,
      siteTitle: siteSettingsService.getSiteTitle()
    });
  }

  public static async editPost(req: Request, res: Response): Promise<void> {
    const id = String(req.params['id'] || '');
    const updated = testimonialsService.update(id, {
      name: (req.body.name || '').trim(),
      quote: (req.body.quote || '').trim(),
      location: (req.body.location || '').trim(),
      rating: parseInt(req.body.rating, 10) || 5,
      sort: parseInt(req.body.sort, 10) || 1000,
      status: req.body.isActive ? 'published' : 'draft'
    });
    if (!updated) {
      res.redirect('/admin/testimonials?error=Testimonial not found');
      return;
    }
    res.redirect('/admin/testimonials?success=Testimonial updated');
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    testimonialsService.delete(String(req.params['id'] || ''));
    res.json({ success: true });
  }
}
