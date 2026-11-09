import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Website',
    tagline: '',
    description: '',
    logo: '',
    favicon: '',
    contactEmail: 'info@example.com',
    contactPhone: '',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: '',
    inquiryTopics: ['General inquiry'],
    themeColor: '#0b3a5b',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  const emptyLink = { label: '', url: '' };
  return {
    hero: { enabled: false, slides: [] },
    about: { enabled: false, title: '', lead: '', text: '', image: '', statValue: '', statLabel: '', cta: emptyLink },
    categories: { enabled: false, title: '', intro: '', categoryIds: [] },
    brands: { enabled: false, title: '', intro: '' },
    featuredProducts: { enabled: false, title: '', intro: '', limit: 8, cta: emptyLink },
    whyUs: { enabled: false, title: '', intro: '', image: '', items: [] },
    contact: { enabled: false, title: '', intro: '' },
    updatedAt: EPOCH
  };
}
