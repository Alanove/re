import type { FuelProduct, FuelPrices, Home, Settings } from './models.js';

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
  return {
    hero: { enabled: false, eyebrow: '', title: '', intro: '', image: '', tiles: [] },
    about: { enabled: false, title: '', heading: '', content: '', image: '', cta: { label: '', url: '' } },
    prices: { enabled: false, title: '', intro: '' },
    testimonials: { enabled: false, title: '', video: '', image: '', items: [] },
    services: { enabled: false, title: '', intro: '', items: [] },
    updatedAt: EPOCH
  };
}

export function defaultFuelProducts(): FuelProduct[] {
  const product = (key: FuelProduct['key'], label: string, sort: number, visible = true): FuelProduct => ({
    key,
    label,
    officialPrice: null,
    override: null,
    overrideUpdatedAt: null,
    visible,
    sort
  });
  return [
    product('unleaded98', 'Unleaded 98', 10),
    product('unleaded95', 'Unleaded 95', 20),
    product('dieselVehicle', 'Diesel Oil', 30),
    product('mazout', 'Gas Oil', 40),
    product('kerosene', 'Kerosene', 50, false)
  ];
}

export function defaultFuelPrices(): FuelPrices {
  return {
    unit: 'L.L. / 20 L',
    sync: { enabled: true, officialDate: null, lastAttemptAt: null, lastSuccessAt: null, lastChangeAt: null, lastError: '' },
    products: defaultFuelProducts(),
    history: [],
    updatedAt: EPOCH
  };
}
