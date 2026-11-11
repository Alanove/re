import { Request, Response } from 'express';
import { SliderService } from '../../admin/services/sliderService';
import { PagesService as AdminPagesService } from '../../admin/services/pagesService';
import projectsService from '../services/projectsService';
import * as fs from 'fs';
import * as path from 'path';
import emailService from '../services/emailService';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { SecurityService } from '../services/securityService';
import pagesService from '../services/pagesService';
import encryptionService from '../services/encryptionService';
import { db } from '../config/database';
import { envConfig } from '../config/env.config';
import { verifyTurnstileToken } from '../utils/turnstile';
import { resolveListingThumbUrl } from '../services/imageThumbService';
const siteSettingsService = SiteSettingsService.getInstance();
const securityService = SecurityService.getInstance();

const sliderService = SliderService.getInstance();
const adminPagesService = AdminPagesService.getInstance();

export class HomeController {
  /**
   * Render home page
   */
  public static async index(req: Request, res: Response): Promise<void> {
    try {
      sliderService.reloadData(); // Reload data to get latest changes
      const slides = await sliderService.getActiveSlides();

      // Get pages tagged with "hero"
      const heroPagesResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 20,
        status: 'published',
        tag: 'hero'
      });
      // Sort by date (newer first) and get only the last 6 hero pages if there are more
      const allHeroPages = (heroPagesResult.pages || []).sort((a: any, b: any) => {
        // Sort by publishDate if available, otherwise updatedAt, otherwise createdAt
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime(); // Descending order (newer first)
      });
      const heroPages = allHeroPages.length > 6 ? allHeroPages.slice(0, 6) : allHeroPages;

      // Get countries with projects for the world map
      const countriesWithProjects = await projectsService.getCountries();

      // Get projects organized by country for tooltips
      const allProjects = await projectsService.getProjects();
      const projectsByCountry: { [country: string]: string[] } = {};

      allProjects.projects.forEach(project => {
        if (project.country) {
          if (!projectsByCountry[project.country]) {
            projectsByCountry[project.country] = [];
          }
          projectsByCountry[project.country].push(project.title);
        }
      });

      // Calculate project statistics
      const totalProjects = allProjects.projects.length;
      const uniqueCountries = [...new Set(allProjects.projects.map(p => p.country).filter(c => c))];
      const totalCountries = uniqueCountries.length;
      const uniqueCategories = [...new Set(allProjects.projects.map(p => p.category).filter(c => c))];
      const totalCategories = uniqueCategories.length;

      // Get latest 4 news articles
      const newsResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 4,
        status: 'published',
        tag: 'news'
      });
      const latestNews = (newsResult.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }).slice(0, 4);

      // Get latest 6 videos
      const videosResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 6,
        status: 'published',
        tag: 'video'
      });
      const latestVideos = (videosResult.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }).slice(0, 6);

      // Get latest 4 announcements (objav tag)
      const announcementsResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 4,
        status: 'published',
        tag: 'objav'
      });
      const latestAnnouncements = (announcementsResult.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }).slice(0, 4);

      // Get all galleries to collect photos from
      const galleriesResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 50, // Get more galleries to collect photos from
        status: 'published',
        tag: 'gallery'
      });
      const allGalleries = (galleriesResult.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Collect photos from all galleries
      const galleryPhotos: any[] = [];
      for (const gallery of allGalleries) {
        const photos = await adminPagesService.getPagePhotos(gallery.id);
        for (const photo of photos) {
          galleryPhotos.push({
            ...photo,
            galleryId: gallery.id,
            gallerySlug: gallery.slug,
            galleryTitle: gallery.title
          });
        }
      }

      // Sort photos by display order and date, then take top 8
      const topPhotos = galleryPhotos
        .sort((a: any, b: any) => {
          // First sort by display order
          if (a.displayOrder !== b.displayOrder) {
            return a.displayOrder - b.displayOrder;
          }
          // Then by creation date (newer first)
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 8);

      // Load e-commerce data
      const productService = (await import('../services/productService')).default;
      const categoryService = (await import('../services/categoryService')).default;
      const brandService = (await import('../services/brandService')).default;

      // Load featured categories (limit 12)
      const allCategories = await categoryService.getCategoryTree();
      const featuredCategories = allCategories.filter((c: any) => c.is_featured).slice(0, 12);

      // Load products per featured category for "Shop by Category" (limit 12 per category)
      const categoryProductsMap: Record<number, any[]> = {};
      for (const cat of featuredCategories) {
        const catResult = await productService.getProducts({
          is_active: true,
          status: 'published',
          category_id: cat.id,
          page: 1,
          limit: 12,
          sort_by: 'created_at',
          sort_order: 'DESC'
        });
        categoryProductsMap[cat.id] = catResult.products || [];
      }

      // Load featured products (limit 8)
      const featuredResult = await productService.getProducts({
        is_active: true,
        status: 'published',
        is_featured: true,
        page: 1,
        limit: 8,
        sort_by: 'created_at',
        sort_order: 'DESC'
      });
      await productService.attachColorOptionsForListing(featuredResult.products || []);

      // Attach color options for category products
      for (const cat of featuredCategories) {
        const catProducts = categoryProductsMap[cat.id] || [];
        await productService.attachColorOptionsForListing(catProducts);
      }

      // Load recent products (limit 8)
      const recentResult = await productService.getProducts({
        is_active: true,
        status: 'published',
        page: 1,
        limit: 8,
        sort_by: 'created_at',
        sort_order: 'DESC'
      });

      // Load brands (for Sub Brands section) – ensure a clean array for the view
      const brandsRaw = await brandService.getActiveBrands();
      const brands = Array.isArray(brandsRaw) ? brandsRaw : [];

      // Get event pages (tagged with "events")
      const eventsResult = await adminPagesService.getPagesWithPagination({
        page: 1,
        itemsPerPage: 8,
        status: 'published',
        tag: 'events'
      });
      const eventPagesRaw = (eventsResult.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      const eventPages = eventPagesRaw.map((e: any) => {
        const pi = String(e.pageImage || '').trim();
        const dbThumb =
          e.pageImageThumb && String(e.pageImageThumb).trim() !== ''
            ? String(e.pageImageThumb).trim()
            : null;
        const pageImageThumb = pi ? resolveListingThumbUrl(pi, dbThumb) || pi : '';
        return { ...e, pageImageThumb };
      });

      res.render('index', {
        slides,
        heroPages,
        countriesWithProjects,
        projectsByCountry,
        projectStats: {
          totalProjects,
          totalCountries,
          totalCategories
        },
        clientsCount: 0, // Default clients count until clients feature is implemented
        latestNews,
        latestVideos,
        latestAnnouncements,
        latestGalleries: allGalleries.slice(0, 4), // Keep for backward compatibility if needed
        galleryPhotos: topPhotos,
        // E-commerce data
        featuredCategories,
        categoryProductsMap,
        featuredProducts: featuredResult.products,
        recentProducts: recentResult.products,
        brands,
        eventPages
      });
    } catch (error) {
      console.error('Error rendering home page:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Render events listing page with pagination
   */
  public static async events(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const itemsPerPage = 20; // 20 events per page

      // Get event pages (tagged with "events")
      const result = await adminPagesService.getPagesWithPagination({
        page,
        itemsPerPage,
        status: 'published',
        tag: 'events'
      });

      // Sort by date (newer first)
      const eventPages = (result.pages || []).sort((a: any, b: any) => {
        const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
        const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      const totalPages = Math.ceil(result.total / itemsPerPage);

      // Set selected state for menu highlighting
      (res.locals as any).selected = 'events';
      (res.locals as any).pageTitle = 'Events';

      res.render('events/list', {
        events: eventPages,
        currentPage: page,
        totalPages: totalPages,
        totalEvents: result.total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      });
    } catch (error) {
      console.error('Error rendering events listing:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle contact form submission
   */
  public static async contactSubmit(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, subject, message } = req.body;
      const errors: string[] = [];

      // Turnstile verification when configured
      if (envConfig.turnstileSecretKey) {
        const token = req.body['cf-turnstile-response'];
        const remoteip = typeof req.ip === 'string' ? req.ip : undefined;
        const valid = await verifyTurnstileToken(token, remoteip);
        if (!valid) {
          (req.session as any).contactError = 'Security verification failed. Please try again.';
          (req.session as any).contactForm = req.body;
          return res.redirect('/contact-us');
        }
      }

      // Enhanced validation
      if (!name || name.trim().length === 0) errors.push('Name is required');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) errors.push('Please enter a valid email address');

      if (!subject || subject.trim().length === 0) errors.push('Subject is required');

      if (!message || message.trim().length === 0) errors.push('Message is required');

      if (errors.length > 0) {
        (req.session as any).contactError = errors.join(', ');
        (req.session as any).contactForm = req.body;
        return res.redirect('/contact-us');
      }

      const siteData = pagesService.getSiteData();
      const adminEmail = emailService.resolveNotificationEmail(siteData.email);

      const sent = await emailService.sendEmail({
        to: adminEmail,
        replyTo: email,
        subject: `Contact Form: ${subject || 'New Message'}`,
        html: `
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `
      });

      if (!sent) {
        (req.session as any).contactError = 'There was a problem sending your message. Please try again later.';
        (req.session as any).contactForm = req.body;
        return res.redirect('/contact-us');
      }

      (req.session as any).contactSuccess = 'Your message has been sent successfully. We will get back to you soon!';
      return res.redirect('/contact-us');

    } catch (error) {
      console.error('Error submitting contact form:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Build HTML email body from sponsorship form data (all body keys except _csrf and formType).
   */
  private static sponsorshipEmailBody(body: Record<string, any>): string {
    const skip = ['_csrf', 'formType'];
    const labels: Record<string, string> = {
      name: 'Name',
      nickname: 'Nickname',
      dateOfBirth: 'Date of Birth',
      age: 'Age',
      occupation: 'Occupation',
      otherOccupation: 'Other occupation',
      yearsOfTraining: 'Years of training',
      styleOfFighting: 'Style of fighting',
      placeOfBirth: 'Place of birth',
      address: 'Address',
      nationalId: 'National ID',
      phone: 'Phone',
      fax: 'Fax',
      mobile: 'Mobile',
      email: 'E-mail',
      officialWebsite: 'Official Website',
      mediaAssociatedWith: 'Media Associated with',
      facebookPage: 'Facebook Page',
      facebookPrivateAccount: 'Facebook Private Account',
      instagram: 'Instagram',
      organizationsEventsPartOf: 'Organizations, events part of',
      fightingRecord: 'Fighting Record',
      otherRecord: 'Other record',
      hoursTrainingPerDay: 'Hours of training a day',
      daysTrainingPerWeek: 'Days of training per week',
      achievements: 'Achievements',
      title: 'Title',
      endorsement: 'Endorsement',
      manager: 'Manager',
      headCoach: 'Head Coach',
      team: 'Team',
      signature: 'Signature'
    };
    let html = '';
    for (const [key, value] of Object.entries(body)) {
      if (skip.includes(key) || value === undefined || value === '') continue;
      const label = labels[key] || key;
      const val = String(value).replace(/\n/g, '<br>');
      html += `<p><strong>${label}:</strong> ${val}</p>`;
    }
    return html || '<p>(No fields filled)</p>';
  }

  /**
   * Handle sponsorship form submission (event or athlete). Sends email with optional file attachment and redirects to the same form page.
   */
  public static async sponsorshipSubmit(req: Request, res: Response): Promise<void> {
    const formType = (req.body?.formType || '').toLowerCase();
    const isEvent = formType === 'event';
    const isAthlete = formType === 'athlete';
    const typeLabel = isEvent ? 'Events' : isAthlete ? 'Athlete' : 'Sponsorship';
    const redirectUrl = isEvent ? '/sponsorship/event' : isAthlete ? '/sponsorship/athlete' : '/sponsorship/event';

    const setError = (message: string) => {
      const body = { ...(req.body || {}) };
      if (isEvent) {
        (req.session as any).sponsorshipEventError = message;
        (req.session as any).sponsorshipEventFormData = body;
      } else {
        (req.session as any).sponsorshipAthleteError = message;
        (req.session as any).sponsorshipAthleteFormData = body;
      }
    };

    try {
      // Validate CSRF for multipart form (skipped by middleware)
      if ((req as any)._skipCsrfValidation) {
        const csrfToken = req.body?._csrf;
        if (!csrfToken) {
          setError('Security token missing. Please refresh the page and try again.');
          return res.redirect(redirectUrl);
        }
        await new Promise<void>((resolve, reject) => {
          const originalBody = req.body;
          securityService.csrfProtection(req, res, (err: any) => {
            req.body = originalBody;
            if (err && err.code === 'EBADCSRFTOKEN') reject(new Error('Invalid CSRF token'));
            else if (err) reject(err);
            else resolve();
          });
        });
      }

      const name = (req.body?.name || '').trim();
      const email = (req.body?.email || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!name) {
        setError('Name is required.');
        return res.redirect(redirectUrl);
      }
      if (!email || !emailRegex.test(email)) {
        setError('Please enter a valid email address.');
        return res.redirect(redirectUrl);
      }

      const ageVal = (req.body?.age || '').toString().trim();
      if (ageVal !== '' && !/^\d+$/.test(ageVal)) {
        setError('Age must be a number.');
        return res.redirect(redirectUrl);
      }
      const ageNum = ageVal === '' ? undefined : parseInt(ageVal, 10);
      if (ageNum !== undefined && (ageNum < 1 || ageNum > 150)) {
        setError('Age must be between 1 and 150.');
        return res.redirect(redirectUrl);
      }

      const siteData = pagesService.getSiteData();
      const adminEmail = emailService.resolveNotificationEmail(siteData.email);
      const subject = `Sponsorship Form (${typeLabel}): ${name}`;
      const html = `
        <h3>Sponsorship Form for ${typeLabel}</h3>
        ${HomeController.sponsorshipEmailBody(req.body)}
        ${(req as any).file ? '<p><strong>Attachment:</strong> A PDF or image file is attached to this email.</p>' : ''}
      `;

      const attachments: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }> = [];
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file && file.path && fs.existsSync(file.path)) {
        attachments.push({
          filename: file.originalname || file.filename || 'attachment',
          path: file.path,
          contentType: file.mimetype
        });
      }

      const emailOptions: Parameters<typeof emailService.sendEmail>[0] = {
        to: adminEmail,
        replyTo: email,
        subject,
        html
      };
      if (attachments.length > 0) {
        emailOptions.attachments = attachments;
      }
      const sent = await emailService.sendEmail(emailOptions);
      if (!sent) {
        setError('There was a problem sending your form. Please try again later.');
        return res.redirect(redirectUrl);
      }

      if (file && file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
      }

      if (isEvent) {
        (req.session as any).sponsorshipEventSuccess = 'Your sponsorship form has been submitted successfully. We will get back to you soon!';
        (req.session as any).sponsorshipEventError = null;
        (req.session as any).sponsorshipEventFormData = null;
      } else {
        (req.session as any).sponsorshipAthleteSuccess = 'Your sponsorship form has been submitted successfully. We will get back to you soon!';
        (req.session as any).sponsorshipAthleteError = null;
        (req.session as any).sponsorshipAthleteFormData = null;
      }
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error submitting sponsorship form:', error);
      setError('There was a problem sending your form. Please try again later.');
      return res.redirect(redirectUrl);
    }
  }

  /**
   * Handle newsletter form submission (footer). Stores email encrypted.
   * Accepts both form POST (redirect) and AJAX JSON (returns JSON).
   */
  public static async newsletterSubmit(req: Request, res: Response): Promise<void> {
    const isAjax = req.get('Accept')?.includes('application/json') || (req as any).xhr === true;
    const sendJson = (success: boolean, message: string, status = success ? 200 : 400): void => {
      if (isAjax) {
        res.status(status).json({ success, message });
        return;
      }
      if (success) (req.session as any).newsletterSuccess = message;
      else (req.session as any).newsletterError = message;
      res.redirect(req.headers.referer || '/');
    };

    try {
      const email = (req.body?.email || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        sendJson(false, 'Please enter a valid email address.');
        return;
      }

      const { content: contentEncrypted, iv } = encryptionService.encrypt({ email });
      await db.query(
        'INSERT INTO newsletter_subscribers (content_encrypted, iv) VALUES (?, ?)',
        [contentEncrypted, iv]
      );
      sendJson(true, 'Thank you for subscribing!');
      return;
    } catch (error) {
      console.error('Error submitting newsletter:', error);
      sendJson(false, 'Something went wrong. Please try again.', 500);
      return;
    }
  }
}
