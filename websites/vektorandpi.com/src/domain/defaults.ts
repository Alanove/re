import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Vektor & PI',
    tagline: 'ACHIEVE THROUGH PEOPLE',
    description: 'Vektor & PI — achieve through people.',
    logo: '/images/vektor-and-pi.png',
    favicon: '/favicon.ico',
    contactEmail: 'reachus@vektorandpi.com',
    contactPhone: '',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: 'Vektor & PI. All rights reserved.',
    inquiryTopics: ['General enquiry'],
    themeColor: '#231f20',
    social: {
      facebook: 'https://www.facebook.com/vektorandpi/',
      instagram: 'https://www.instagram.com/vektorandpi/',
      linkedin: 'https://www.linkedin.com/company/vektorandpi/',
      youtube: '',
      twitter: ''
    },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Thank you. Your message has been received.',
    analyticsId: 'UA-172431180-1',
    googleMapsApiKey: 'AIzaSyCDXBhxQFY31T9cK_bYuDFETlVh7jOU_00',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '/images/vektor-and-pi.png' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  return {
    hero: { enabled: false, interval: 6, slides: [] },
    about: { enabled: false, title: '', content: '', image: '' },
    mission: { enabled: false, title: '', content: '', image: '', url: '' },
    tiles: [],
    marquee: '',
    solidarity: { enabled: false, image: '', url: '', title: '' },
    latestPosts: { enabled: false, title: '', intro: '', limit: 3 },
    gallery: { enabled: false, title: '', intro: '' },
    updatedAt: EPOCH
  };
}
