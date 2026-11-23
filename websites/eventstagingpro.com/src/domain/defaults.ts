import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Event Staging Professionals',
    tagline: '',
    description: 'Event Staging Professionals builds stages, towers and stadiums for festivals, concerts, weddings and events in Lebanon.',
    logo: '',
    favicon: '',
    contactEmail: 'info@eventstagingpro.com',
    contactPhone: '+961 5 940704',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: 'Copyright. All Rights Reserved',
    inquiryTopics: ['General inquiry'],
    themeColor: '#000000',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '', twitter: '' },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  return {
    hero: { enabled: false, interval: 6, slides: [] },
    about: { enabled: false, title: '', content: '', image: '' },
    latestPosts: { enabled: false, title: 'Latest Posts', intro: '', limit: 3 },
    gallery: { enabled: false, title: 'Media Gallery', intro: '' },
    updatedAt: EPOCH
  };
}
