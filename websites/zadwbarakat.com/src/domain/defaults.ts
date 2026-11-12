import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Website',
    tagline: '',
    description: '',
    logo: '',
    emblem: '',
    favicon: '',
    contactEmail: 'info@example.com',
    contactPhone: '',
    address: '',
    mapQuery: '',
    footerText: '',
    copyright: '',
    inquiryTopics: ['استفسار عام'],
    themeColor: '#007d90',
    social: { facebook: '', x: '', instagram: '', youtube: '' },
    relatedLinks: [],
    thankYouMessage: 'شكرًا لكم. وصلتنا رسالتكم وسنتواصل معكم قريبًا.',
    newsletterThankYou: 'شكرًا لاشتراككم في الرسالة الإخبارية.',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  return {
    spotlight: { enabled: false, title: '', count: 5, sectionId: null },
    sections: { enabled: false, title: '', sectionIds: [], count: 3 },
    questions: { enabled: false, title: '', intro: '', count: 4, sectionId: null },
    hymns: { enabled: false, title: '', intro: '', count: 6 },
    videos: { enabled: false, title: '', count: 4 },
    albums: { enabled: false, title: '', count: 4 },
    newsletter: { enabled: false, title: '', text: '' },
    updatedAt: EPOCH
  };
}
