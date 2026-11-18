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
    hero: { enabled: false, eyebrow: '', slogans: [], image: '', primaryCta: emptyLink, secondaryCta: emptyLink },
    about: { enabled: false, title: '', content: '', highlight: '', statValue: '', statLabel: '' },
    studios: { enabled: false, title: '', content: '', quote: '', image: '' },
    services: { enabled: false, title: '', intro: '', items: [] },
    team: { enabled: false, title: '', content: '', members: [] },
    latestPosts: { enabled: false, title: '', intro: '', limit: 3 },
    contact: { enabled: false, title: '', intro: '', image: '' },
    updatedAt: EPOCH
  };
}
