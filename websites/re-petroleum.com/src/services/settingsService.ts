import type { z } from 'zod';
import type { Settings } from '../domain/models.js';
import { settingsRepository } from '../repositories/singletonRepositories.js';
import type { settingsFormSchema } from '../schemas/adminSchemas.js';

type SettingsInput = z.infer<typeof settingsFormSchema>;

export function whatsappChatUrl(number: string): string {
  const digits = number.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8 || digits.length > 15) {
    return '';
  }
  return `https://wa.me/${digits}`;
}

export class SettingsService {
  public async get(): Promise<Settings> {
    return settingsRepository.get();
  }

  public async update(
    input: SettingsInput,
    uploads: { logo: string | null; favicon: string | null; brochureUrl: string | null; seoDefaultImage: string | null }
  ): Promise<Settings> {
    return settingsRepository.save({
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
      seo: {
        defaultTitle: input.seoDefaultTitle,
        defaultDescription: input.seoDefaultDescription,
        defaultKeywords: input.seoDefaultKeywords,
        defaultImage: uploads.seoDefaultImage ?? input.seoDefaultImage
      },
      updatedAt: new Date().toISOString()
    });
  }
}

export const settingsService = new SettingsService();
