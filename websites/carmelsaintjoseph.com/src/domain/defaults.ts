import type { Home, Settings } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Collège du Carmel Saint Joseph',
    tagline: '',
    description: 'Collège du Carmel Saint Joseph à Mechref — Damour. Établissement scolaire homologué AEFE.',
    logo: '',
    favicon: '',
    contactEmail: 'info@carmelsaintjoseph.edu.lb',
    contactPhone: '+961 5 601 171',
    whatsappNumber: '',
    brochureUrl: '',
    footerText: '',
    copyright: 'Carmel Saint Joseph. Tous les droits sont réservés.',
    inquiryTopics: ['Demande générale', 'Inscriptions', 'Recrutement'],
    themeColor: '#623D19',
    social: {
      facebook: 'https://www.facebook.com/CollegeduCarmelSaintJoseph/',
      instagram: 'https://www.instagram.com/collegeducarmelsaintjoseph/',
      linkedin: '',
      youtube: 'https://www.youtube.com/channel/UCWCfey4Bk1eLuRWUiTKUlyw',
      twitter: ''
    },
    ctaBand: { title: '', text: '', label: '' },
    thankYouMessage: 'Merci. Votre message a bien été reçu.',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
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
    latestPosts: { enabled: false, title: 'Actualités', intro: '', limit: 3 },
    gallery: { enabled: false, title: 'Visite Virtuelle', intro: '' },
    updatedAt: EPOCH
  };
}
