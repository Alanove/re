import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import pagesService from '../services/pagesService';
import { emailService } from '../services/emailService';
import { getSharp } from '../services/sharpLoader';
import { SiteSettingsService } from '../../admin/services/siteSettingsService';
import { apartmentsService, Apartment } from '../../admin/services/apartmentsService';

const siteSettingsService = SiteSettingsService.getInstance();

export const CONTACT_SUBJECTS: Record<string, string> = {
  'apartment-inquiry': 'Inquire About Apartment',
  'report-problem': 'Report a Problem',
  'event-noise-notice': 'Event or Noise Notice',
  'work-execution': 'Announce Work Execution',
  'pool-reservation': 'Request Pool for Private Party',
  other: 'Other'
};

export type ContactApartmentOption = {
  id: number;
  label: string;
};

function wantsJson(req: Request): boolean {
  return req.xhr || req.headers.accept?.includes('application/json') === true;
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseApartmentId(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = parseInt(trim(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function apartmentContactLabel(apartment: Apartment): string {
  const unit = apartment.unitNumberOfficial || apartment.unitNumberUnofficial || apartment.id;
  const statusLabel =
    apartment.status === 'for_sale' ? 'For Sale' : apartment.status === 'for_rent' ? 'For Rent' : '';
  const base = `Block ${apartment.block || '—'}, Unit ${unit}`;
  return statusLabel ? `${base} (${statusLabel})` : base;
}

async function getListedApartmentOptions(): Promise<ContactApartmentOption[]> {
  const [forRent, forSale] = await Promise.all([
    apartmentsService.getApartmentsByStatus('for_rent'),
    apartmentsService.getApartmentsByStatus('for_sale')
  ]);

  const byId = new Map<number, ContactApartmentOption>();
  [...forSale, ...forRent].forEach((apartment) => {
    byId.set(apartment.id, {
      id: apartment.id,
      label: apartmentContactLabel(apartment)
    });
  });

  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

async function resolveApartmentLabel(apartmentId: number | null): Promise<string> {
  if (!apartmentId) return '';
  const apartment = await apartmentsService.getApartmentById(apartmentId);
  return apartment ? apartmentContactLabel(apartment) : `Apartment #${apartmentId}`;
}

export class ContactController {
  static async show(req: Request, res: Response): Promise<void> {
    const prefillApartmentId = parseApartmentId(req.query.apartment);
    const prefillSubject = prefillApartmentId ? 'apartment-inquiry' : '';

    try {
      const [siteSettings, contactPage] = await Promise.all([
        siteSettingsService.getAllSettings(),
        pagesService.getPageBySlug('contact')
      ]);
      const siteName = pagesService.getSiteData().name;
      const pageImage =
        contactPage?.seoImage ||
        contactPage?.backgroundImage ||
        '';

      (res.locals as any).pageTitle = `Contact Us - ${siteName}`;
      (res.locals as any).pageDescription =
        contactPage?.metaDescription ||
        'Contact Santa Maria Bouar — compound office, coordinator, map, and inquiry form.';
      (res.locals as any).pageImage = pageImage;
      (res.locals as any).includeBootstrap = true;
      (res.locals as any).includeRecaptcha = true;
      (res.locals as any).pageScript = '/js/contact-form.js';

      const listedApartments = await getListedApartmentOptions();
      if (prefillApartmentId && !listedApartments.some((a) => a.id === prefillApartmentId)) {
        const apartment = await apartmentsService.getApartmentById(prefillApartmentId);
        if (apartment) {
          listedApartments.unshift({
            id: apartment.id,
            label: apartmentContactLabel(apartment)
          });
        }
      }

      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings,
        pageImage,
        apartmentPrefill: prefillApartmentId ? String(prefillApartmentId) : '',
        subjectPrefill: prefillSubject,
        listedApartments,
        subjects: CONTACT_SUBJECTS,
        queryError: trim(req.query.error),
        querySuccess: req.query.success === '1'
      });
    } catch (error) {
      console.error('Error loading contact page:', error);
      (res.locals as any).includeBootstrap = true;
      (res.locals as any).includeRecaptcha = true;
      (res.locals as any).pageScript = '/js/contact-form.js';
      res.render('contact', {
        siteData: pagesService.getSiteData(),
        siteSettings: {},
        pageImage: '',
        apartmentPrefill: prefillApartmentId ? String(prefillApartmentId) : '',
        subjectPrefill: prefillSubject,
        listedApartments: [],
        subjects: CONTACT_SUBJECTS,
        queryError: trim(req.query.error),
        querySuccess: req.query.success === '1'
      });
    }
  }

  static async submit(req: Request, res: Response): Promise<void> {
    const respondError = (status: number, message: string): void => {
      if (wantsJson(req)) {
        res.status(status).json({ success: false, message });
        return;
      }
      res.redirect(`/contact?error=${encodeURIComponent(message)}`);
    };

    try {
      const fullName = trim(req.body.fullName);
      const email = trim(req.body.email);
      const phone = trim(req.body.phone);
      const subject = trim(req.body.subject);
      const message = trim(req.body.message);
      const apartmentId = parseApartmentId(req.body.apartment);
      const workType = trim(req.body.workType);
      const workFrom = trim(req.body.workFrom);
      const workTo = trim(req.body.workTo);
      const eventDate = trim(req.body.eventDate);
      const eventTime = trim(req.body.eventTime);
      const poolDate = trim(req.body.poolDate);
      const poolTime = trim(req.body.poolTime);

      if (!fullName || !email || !phone) {
        respondError(400, 'Please enter your name, email, and phone number.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        respondError(400, 'Please enter a valid email address.');
        return;
      }

      if (!subject || !CONTACT_SUBJECTS[subject]) {
        respondError(400, 'Please select a subject.');
        return;
      }

      if (subject === 'work-execution') {
        if (!workType) {
          respondError(400, 'Please describe the type of work.');
          return;
        }
        if (!workFrom || !workTo) {
          respondError(400, 'Please provide the work duration (from and to dates).');
          return;
        }
        const mapFile = req.file;
        if (!mapFile) {
          respondError(400, 'Please attach a site map or location photo for the work.');
          return;
        }
        const sharp = getSharp();
        if (sharp) {
          try {
            const meta = await sharp(mapFile.path).metadata();
            if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
              fs.unlinkSync(mapFile.path);
              respondError(400, 'The site map photo must be a valid JPG, PNG, or WebP image.');
              return;
            }
          } catch {
            try {
              fs.unlinkSync(mapFile.path);
            } catch {
              /* ignore */
            }
            respondError(400, 'The site map photo must be a valid image file.');
            return;
          }
        } else {
          const ext = path.extname(mapFile.originalname || mapFile.path).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            try {
              fs.unlinkSync(mapFile.path);
            } catch {
              /* ignore */
            }
            respondError(400, 'The site map photo must be a valid JPG, PNG, or WebP image.');
            return;
          }
        }
      }

      if (subject === 'pool-reservation') {
        if (!poolDate || !poolTime) {
          respondError(400, 'Please specify the date and time for the pool reservation.');
          return;
        }
      }

      if (!message) {
        respondError(400, 'Please enter a message.');
        return;
      }

      if (subject === 'apartment-inquiry' && !apartmentId) {
        respondError(400, 'Please select an apartment.');
        return;
      }

      const subjectLabel = CONTACT_SUBJECTS[subject];
      const mapFile = req.file;
      const apartmentLabel =
        subject === 'apartment-inquiry' ? await resolveApartmentLabel(apartmentId) : '';

      await emailService.sendContactMessage({
        fullName,
        email,
        phone,
        subject,
        subjectLabel,
        message,
        apartment: apartmentLabel || undefined,
        workType: subject === 'work-execution' ? workType : undefined,
        workFrom: subject === 'work-execution' ? workFrom : undefined,
        workTo: subject === 'work-execution' ? workTo : undefined,
        eventDate: subject === 'event-noise-notice' ? eventDate : undefined,
        eventTime: subject === 'event-noise-notice' ? eventTime : undefined,
        poolDate: subject === 'pool-reservation' ? poolDate : undefined,
        poolTime: subject === 'pool-reservation' ? poolTime : undefined,
        mapAttachment: mapFile
          ? { filename: mapFile.originalname, path: mapFile.path }
          : undefined
      });

      if (wantsJson(req)) {
        res.json({ success: true, message: 'Your message has been sent. We will get back to you soon.' });
        return;
      }

      res.redirect('/contact?success=1');
    } catch (error) {
      console.error('Error submitting contact form:', error);
      respondError(500, 'Could not send your message. Please try again later.');
    }
  }
}
