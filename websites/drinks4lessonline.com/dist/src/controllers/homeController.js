"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeController = void 0;
const sliderService_1 = require("../../admin/services/sliderService");
const pagesService_1 = require("../../admin/services/pagesService");
const projectsService_1 = __importDefault(require("../services/projectsService"));
const fs = __importStar(require("fs"));
const emailService_1 = __importDefault(require("../services/emailService"));
const siteSettingsService_1 = require("../../admin/services/siteSettingsService");
const securityService_1 = require("../services/securityService");
const pagesService_2 = __importDefault(require("../services/pagesService"));
const encryptionService_1 = __importDefault(require("../services/encryptionService"));
const database_1 = require("../config/database");
const env_config_1 = require("../config/env.config");
const turnstile_1 = require("../utils/turnstile");
const imageThumbService_1 = require("../services/imageThumbService");
const siteSettingsService = siteSettingsService_1.SiteSettingsService.getInstance();
const securityService = securityService_1.SecurityService.getInstance();
const sliderService = sliderService_1.SliderService.getInstance();
const adminPagesService = pagesService_1.PagesService.getInstance();
class HomeController {
    static async index(req, res) {
        try {
            sliderService.reloadData();
            const slides = await sliderService.getActiveSlides();
            const heroPagesResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 20,
                status: 'published',
                tag: 'hero'
            });
            const allHeroPages = (heroPagesResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            const heroPages = allHeroPages.length > 6 ? allHeroPages.slice(0, 6) : allHeroPages;
            const countriesWithProjects = await projectsService_1.default.getCountries();
            const allProjects = await projectsService_1.default.getProjects();
            const projectsByCountry = {};
            allProjects.projects.forEach(project => {
                if (project.country) {
                    if (!projectsByCountry[project.country]) {
                        projectsByCountry[project.country] = [];
                    }
                    projectsByCountry[project.country].push(project.title);
                }
            });
            const totalProjects = allProjects.projects.length;
            const uniqueCountries = [...new Set(allProjects.projects.map(p => p.country).filter(c => c))];
            const totalCountries = uniqueCountries.length;
            const uniqueCategories = [...new Set(allProjects.projects.map(p => p.category).filter(c => c))];
            const totalCategories = uniqueCategories.length;
            const newsResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 4,
                status: 'published',
                tag: 'news'
            });
            const latestNews = (newsResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            }).slice(0, 4);
            const videosResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 6,
                status: 'published',
                tag: 'video'
            });
            const latestVideos = (videosResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            }).slice(0, 6);
            const announcementsResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 4,
                status: 'published',
                tag: 'objav'
            });
            const latestAnnouncements = (announcementsResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            }).slice(0, 4);
            const galleriesResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 50,
                status: 'published',
                tag: 'gallery'
            });
            const allGalleries = (galleriesResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            const galleryPhotos = [];
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
            const topPhotos = galleryPhotos
                .sort((a, b) => {
                if (a.displayOrder !== b.displayOrder) {
                    return a.displayOrder - b.displayOrder;
                }
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            })
                .slice(0, 8);
            const productService = (await Promise.resolve().then(() => __importStar(require('../services/productService')))).default;
            const categoryService = (await Promise.resolve().then(() => __importStar(require('../services/categoryService')))).default;
            const brandService = (await Promise.resolve().then(() => __importStar(require('../services/brandService')))).default;
            const allCategories = await categoryService.getCategoryTree();
            const featuredCategories = allCategories.filter((c) => c.is_featured).slice(0, 12);
            const shopRootSlugs = ['cigarettes', 'cigars', 'shisha', 'spirits', 'wines', 'gifts'];
            const shopRoots = shopRootSlugs
                .map((slug) => allCategories.find((c) => String(c.slug).toLowerCase() === slug))
                .filter(Boolean);
            const categoryProductsMap = {};
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
            const { HomepageSettingsService } = await Promise.resolve().then(() => __importStar(require('../../admin/services/homepageSettingsService')));
            const homepageSettings = await HomepageSettingsService.getInstance().getSettings();
            let saleProducts = [];
            if (homepageSettings.saleEnabled) {
                const saleResult = await productService.getProducts({
                    is_active: true,
                    status: 'published',
                    on_sale: true,
                    page: 1,
                    limit: 8,
                    sort_by: 'created_at',
                    sort_order: 'DESC'
                });
                saleProducts = saleResult.products || [];
                await productService.attachColorOptionsForListing(saleProducts);
            }
            for (const cat of featuredCategories) {
                const catProducts = categoryProductsMap[cat.id] || [];
                await productService.attachColorOptionsForListing(catProducts);
            }
            const recentResult = await productService.getProducts({
                is_active: true,
                status: 'published',
                page: 1,
                limit: 8,
                sort_by: 'created_at',
                sort_order: 'DESC'
            });
            const brandsRaw = await brandService.getActiveBrands();
            const brands = Array.isArray(brandsRaw) ? brandsRaw : [];
            const eventsResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 8,
                status: 'published',
                tag: 'events'
            });
            const eventPagesRaw = (eventsResult.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            const eventPages = eventPagesRaw.map((e) => {
                const pi = String(e.pageImage || '').trim();
                const dbThumb = e.pageImageThumb && String(e.pageImageThumb).trim() !== ''
                    ? String(e.pageImageThumb).trim()
                    : null;
                const pageImageThumb = pi ? (0, imageThumbService_1.resolveListingThumbUrl)(pi, dbThumb) || pi : '';
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
                clientsCount: 0,
                latestNews,
                latestVideos,
                latestAnnouncements,
                latestGalleries: allGalleries.slice(0, 4),
                galleryPhotos: topPhotos,
                featuredCategories,
                shopRoots,
                categoryProductsMap,
                featuredProducts: featuredResult.products,
                recentProducts: recentResult.products,
                homepageSettings,
                saleProducts,
                brands,
                eventPages
            });
        }
        catch (error) {
            console.error('Error rendering home page:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async events(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 20;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'events'
            });
            const eventPages = (result.pages || []).sort((a, b) => {
                const dateA = a.publishDate || a.updatedAt || a.createdAt || '';
                const dateB = b.publishDate || b.updatedAt || b.createdAt || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            res.locals.selected = 'events';
            res.locals.pageTitle = 'Events';
            res.render('events/list', {
                events: eventPages,
                currentPage: page,
                totalPages: totalPages,
                totalEvents: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            });
        }
        catch (error) {
            console.error('Error rendering events listing:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async contactSubmit(req, res) {
        try {
            const { name, email, subject, message } = req.body;
            const errors = [];
            if (env_config_1.envConfig.turnstileSecretKey) {
                const token = req.body['cf-turnstile-response'];
                const remoteip = typeof req.ip === 'string' ? req.ip : undefined;
                const valid = await (0, turnstile_1.verifyTurnstileToken)(token, remoteip);
                if (!valid) {
                    req.session.contactError = 'Security verification failed. Please try again.';
                    req.session.contactForm = req.body;
                    return res.redirect('/contact-us');
                }
            }
            if (!name || name.trim().length === 0)
                errors.push('Name is required');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email))
                errors.push('Please enter a valid email address');
            if (!subject || subject.trim().length === 0)
                errors.push('Subject is required');
            if (!message || message.trim().length === 0)
                errors.push('Message is required');
            if (errors.length > 0) {
                req.session.contactError = errors.join(', ');
                req.session.contactForm = req.body;
                return res.redirect('/contact-us');
            }
            const siteData = pagesService_2.default.getSiteData();
            const adminEmail = emailService_1.default.resolveNotificationEmail(siteData.email);
            const sent = await emailService_1.default.sendEmail({
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
                req.session.contactError = 'There was a problem sending your message. Please try again later.';
                req.session.contactForm = req.body;
                return res.redirect('/contact-us');
            }
            req.session.contactSuccess = 'Your message has been sent successfully. We will get back to you soon!';
            return res.redirect('/contact-us');
        }
        catch (error) {
            console.error('Error submitting contact form:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static sponsorshipEmailBody(body) {
        const skip = ['_csrf', 'formType'];
        const labels = {
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
            if (skip.includes(key) || value === undefined || value === '')
                continue;
            const label = labels[key] || key;
            const val = String(value).replace(/\n/g, '<br>');
            html += `<p><strong>${label}:</strong> ${val}</p>`;
        }
        return html || '<p>(No fields filled)</p>';
    }
    static async sponsorshipSubmit(req, res) {
        const formType = (req.body?.formType || '').toLowerCase();
        const isEvent = formType === 'event';
        const isAthlete = formType === 'athlete';
        const typeLabel = isEvent ? 'Events' : isAthlete ? 'Athlete' : 'Sponsorship';
        const redirectUrl = isEvent ? '/sponsorship/event' : isAthlete ? '/sponsorship/athlete' : '/sponsorship/event';
        const unlinkUpload = () => {
            const file = req.file;
            if (file?.path && fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch (_) { }
            }
        };
        const setError = (message) => {
            const body = { ...(req.body || {}) };
            if (isEvent) {
                req.session.sponsorshipEventError = message;
                req.session.sponsorshipEventFormData = body;
            }
            else {
                req.session.sponsorshipAthleteError = message;
                req.session.sponsorshipAthleteFormData = body;
            }
        };
        try {
            if (req._skipCsrfValidation) {
                const csrfToken = req.body?._csrf;
                if (!csrfToken) {
                    unlinkUpload();
                    setError('Security token missing. Please refresh the page and try again.');
                    return res.redirect(redirectUrl);
                }
                await new Promise((resolve, reject) => {
                    const originalBody = req.body;
                    securityService.csrfProtection(req, res, (err) => {
                        req.body = originalBody;
                        if (err && err.code === 'EBADCSRFTOKEN')
                            reject(new Error('Invalid CSRF token'));
                        else if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
            }
            if (env_config_1.envConfig.turnstileSecretKey) {
                const token = req.body['cf-turnstile-response'];
                const remoteip = typeof req.ip === 'string' ? req.ip : undefined;
                const valid = await (0, turnstile_1.verifyTurnstileToken)(token, remoteip);
                if (!valid) {
                    unlinkUpload();
                    setError('Security verification failed. Please try again.');
                    return res.redirect(redirectUrl);
                }
            }
            const name = (req.body?.name || '').trim();
            const email = (req.body?.email || '').trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!name) {
                unlinkUpload();
                setError('Name is required.');
                return res.redirect(redirectUrl);
            }
            if (!email || !emailRegex.test(email)) {
                unlinkUpload();
                setError('Please enter a valid email address.');
                return res.redirect(redirectUrl);
            }
            const ageVal = (req.body?.age || '').toString().trim();
            if (ageVal !== '' && !/^\d+$/.test(ageVal)) {
                unlinkUpload();
                setError('Age must be a number.');
                return res.redirect(redirectUrl);
            }
            const ageNum = ageVal === '' ? undefined : parseInt(ageVal, 10);
            if (ageNum !== undefined && (ageNum < 1 || ageNum > 150)) {
                unlinkUpload();
                setError('Age must be between 1 and 150.');
                return res.redirect(redirectUrl);
            }
            const siteData = pagesService_2.default.getSiteData();
            const adminEmail = emailService_1.default.resolveNotificationEmail(siteData.email);
            const subject = `Sponsorship Form (${typeLabel}): ${name}`;
            const html = `
        <h3>Sponsorship Form for ${typeLabel}</h3>
        ${HomeController.sponsorshipEmailBody(req.body)}
        ${req.file ? '<p><strong>Attachment:</strong> A PDF or image file is attached to this email.</p>' : ''}
      `;
            const attachments = [];
            const file = req.file;
            if (file && file.path && fs.existsSync(file.path)) {
                attachments.push({
                    filename: file.originalname || file.filename || 'attachment',
                    path: file.path,
                    contentType: file.mimetype
                });
            }
            const emailOptions = {
                to: adminEmail,
                replyTo: email,
                subject,
                html
            };
            if (attachments.length > 0) {
                emailOptions.attachments = attachments;
            }
            const sent = await emailService_1.default.sendEmail(emailOptions);
            if (!sent) {
                unlinkUpload();
                setError('There was a problem sending your form. Please try again later.');
                return res.redirect(redirectUrl);
            }
            unlinkUpload();
            if (isEvent) {
                req.session.sponsorshipEventSuccess = 'Your sponsorship form has been submitted successfully. We will get back to you soon!';
                req.session.sponsorshipEventError = null;
                req.session.sponsorshipEventFormData = null;
            }
            else {
                req.session.sponsorshipAthleteSuccess = 'Your sponsorship form has been submitted successfully. We will get back to you soon!';
                req.session.sponsorshipAthleteError = null;
                req.session.sponsorshipAthleteFormData = null;
            }
            return res.redirect(redirectUrl);
        }
        catch (error) {
            console.error('Error submitting sponsorship form:', error);
            unlinkUpload();
            setError('There was a problem sending your form. Please try again later.');
            return res.redirect(redirectUrl);
        }
    }
    static async newsletterSubmit(req, res) {
        const isAjax = req.get('Accept')?.includes('application/json') || req.xhr === true;
        const sendJson = (success, message, status = success ? 200 : 400) => {
            if (isAjax) {
                res.status(status).json({ success, message });
                return;
            }
            if (success)
                req.session.newsletterSuccess = message;
            else
                req.session.newsletterError = message;
            res.redirect(req.headers.referer || '/');
        };
        try {
            if (env_config_1.envConfig.turnstileSecretKey) {
                const token = req.body['cf-turnstile-response'] || req.body?.cf_turnstile_response;
                const remoteip = typeof req.ip === 'string' ? req.ip : undefined;
                const valid = await (0, turnstile_1.verifyTurnstileToken)(token, remoteip);
                if (!valid) {
                    sendJson(false, 'Security verification failed. Please try again.');
                    return;
                }
            }
            const email = (req.body?.email || '').trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                sendJson(false, 'Please enter a valid email address.');
                return;
            }
            const { content: contentEncrypted, iv } = encryptionService_1.default.encrypt({ email });
            await database_1.db.query('INSERT INTO newsletter_subscribers (content_encrypted, iv) VALUES (?, ?)', [contentEncrypted, iv]);
            sendJson(true, 'Thank you for subscribing!');
            return;
        }
        catch (error) {
            console.error('Error submitting newsletter:', error);
            sendJson(false, 'Something went wrong. Please try again.', 500);
            return;
        }
    }
}
exports.HomeController = HomeController;
//# sourceMappingURL=homeController.js.map