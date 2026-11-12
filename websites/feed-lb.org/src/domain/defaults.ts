import { defaultDonationSettings, type Home, type Settings } from './models.js';

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
    themeColor: '#076532',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received and our team will contact you shortly.',
    donation: defaultDonationSettings(),
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  const list = { enabled: false, title: '', intro: '', sourceKey: '', count: 4 };
  return {
    hero: { enabled: false, interval: 7, slides: [] },
    programs: { ...list },
    about: { ...list, count: 3 },
    news: { enabled: false, title: '', intro: '', count: 3 },
    team: { ...list, count: 6 },
    partners: { enabled: false, title: '', intro: '' },
    donate: { enabled: false, title: '', text: '', label: '', image: '' },
    updatedAt: EPOCH
  };
}
