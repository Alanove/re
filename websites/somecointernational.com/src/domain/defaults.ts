import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Someco International S.A.L.',
    tagline: '',
    description: 'Someco International showroom and service center, Dora Highway, Beirut, Lebanon.',
    logo: '',
    favicon: '',
    contactEmail: 'info@somecointernational.com',
    contactPhone: '+961 1 576777',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: '© Someco International S.A.L.',
    inquiryTopics: ['General inquiry', 'Products', 'Services', 'Feedback'],
    themeColor: '#006293',
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
    clients: { enabled: false, title: 'Our Clients' },
    updatedAt: EPOCH
  };
}
