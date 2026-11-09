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
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  const emptyLink = { label: '', url: '' };
  return {
    hero: { enabled: false, slides: [] },
    about: { enabled: false, title: '', lead: '', text: '', image: '', statValue: '', statLabel: '', cta: emptyLink },
    values: { enabled: false, title: '', intro: '', items: [] },
    solar: { enabled: false, title: '', text: '', image: '', cards: [], listTitle: '', list: [], cta: emptyLink },
    activities: { enabled: false, title: '', intro: '', items: [] },
    presence: { enabled: false, title: '', intro: '', image: '' },
    contact: { enabled: false, title: '', intro: '' },
    updatedAt: EPOCH
  };
}
