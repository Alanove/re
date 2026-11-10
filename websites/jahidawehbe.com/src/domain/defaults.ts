import { HERO_INTERVAL_DEFAULT, socialNetworkKeys, type Home, type Settings, type Social, type SocialNetworkKey, type VideoLibrary } from './models.js';

const EPOCH = new Date(0).toISOString();

export function defaultSettings(): Settings {
  return {
    siteName: 'Website',
    tagline: '',
    description: '',
    logo: '',
    favicon: '',
    footerText: '',
    copyright: '',
    themeColor: '#0d0b0a',
    seo: { defaultTitle: '', defaultDescription: '', defaultKeywords: '', defaultImage: '' },
    updatedAt: EPOCH
  };
}

export function defaultHome(): Home {
  const list = { enabled: false, title: '', intro: '', count: 3 };
  return {
    hero: { enabled: false, eyebrow: '', title: '', intro: '', textSide: 'bottom', interval: HERO_INTERVAL_DEFAULT, slides: [], cta: { label: '', url: '' } },
    upcoming: { ...list, title: 'Upcoming concerts' },
    videos: { ...list, count: 6 },
    about: { enabled: false, title: '', heading: '', content: '', image: '', cta: { label: '', url: '' } },
    quotes: { enabled: false, title: '', image: '', items: [] },
    events: { ...list },
    news: { ...list },
    updatedAt: EPOCH
  };
}

export function emptySocialProfiles(): Record<SocialNetworkKey, string> {
  return Object.fromEntries(socialNetworkKeys.map((key) => [key, ''])) as Record<SocialNetworkKey, string>;
}

export function defaultSocial(): Social {
  return {
    profiles: emptySocialProfiles(),
    instagram: { enabled: false, title: 'On Instagram', intro: '', posts: [] },
    updatedAt: EPOCH
  };
}

export function defaultVideoLibrary(): VideoLibrary {
  return {
    channelId: '',
    sync: { enabled: true, lastAttemptAt: null, lastSuccessAt: null, lastChangeAt: null, lastError: '', lastCount: 0 },
    items: [],
    updatedAt: EPOCH
  };
}
