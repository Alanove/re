import type { z } from 'zod';
import type { Settings } from '../domain/models.js';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { settingsRepository } from '../repositories/singletonRepositories.js';
import type { settingsFormSchema } from '../schemas/adminSchemas.js';

type SettingsInput = z.infer<typeof settingsFormSchema>;

export function whatsappChatUrl(number: string, greeting = ''): string {
  const digits = number.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8 || digits.length > 15) {
    return '';
  }
  return greeting ? `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}` : `https://wa.me/${digits}`;
}

const ADMIN_UPLOAD_PATTERN = /^\/uploads\/site\/\d{4}\//;

function settingsMedia(settings: Settings): string[] {
  return [settings.logo, settings.favicon, settings.brochureUrl, settings.seo.defaultImage].filter(Boolean);
}

export class SettingsService {
  public async get(): Promise<Settings> {
    return settingsRepository.get();
  }

  public async update(
    input: SettingsInput,
    uploads: { logo: string | null; favicon: string | null; brochureUrl: string | null; seoDefaultImage: string | null }
  ): Promise<Settings> {
    const previous = await settingsRepository.get();
    const saved = await settingsRepository.save({
      siteName: input.siteName,
      tagline: input.tagline,
      description: input.description,
      logo: uploads.logo ?? input.logo,
      favicon: uploads.favicon ?? input.favicon,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      whatsappNumber: input.whatsappNumber,
      brochureUrl: uploads.brochureUrl ?? input.brochureUrl,
      footerText: input.footerText,
      copyright: input.copyright,
      inquiryTopics: input.inquiryTopics,
      themeColor: input.themeColor,
      social: {
        facebook: input.socialFacebook,
        instagram: input.socialInstagram,
        linkedin: input.socialLinkedin,
        youtube: input.socialYoutube
      },
      ctaBand: { title: input.ctaTitle, text: input.ctaText, label: input.ctaLabel },
      thankYouMessage: input.thankYouMessage,
      seo: {
        defaultTitle: input.seoDefaultTitle,
        defaultDescription: input.seoDefaultDescription,
        defaultKeywords: input.seoDefaultKeywords,
        defaultImage: uploads.seoDefaultImage ?? input.seoDefaultImage
      },
      updatedAt: new Date().toISOString()
    });
    const kept = new Set(settingsMedia(saved));
    for (const url of settingsMedia(previous)) {
      if (ADMIN_UPLOAD_PATTERN.test(url) && !kept.has(url)) {
        await mediaRepository.remove(url);
      }
    }
    return saved;
  }
}

export const settingsService = new SettingsService();
