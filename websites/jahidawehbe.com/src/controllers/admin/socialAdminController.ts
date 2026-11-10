import type { Request, Response } from 'express';
import { INSTAGRAM_POSTS_MAX, socialNetworkKeys, type Social } from '../../domain/models.js';
import { safeParseFields } from '../../middleware/validate.js';
import { socialFormSchema } from '../../schemas/adminSchemas.js';
import { SOCIAL_HOSTS, SOCIAL_LABELS, instagramPostUrl, socialService } from '../../services/socialService.js';
import { formErrorState, render, setFlash, toRawRowFields } from './helpers.js';

interface SocialFormValues {
  profiles: Record<string, string>;
  instagramEnabled: boolean;
  instagramTitle: string;
  instagramIntro: string;
  instagramPosts: { url: string }[];
}

function valuesFromSocial(social: Social): SocialFormValues {
  return {
    profiles: Object.fromEntries(socialNetworkKeys.map((key) => [key, social.profiles[key] ?? ''])),
    instagramEnabled: social.instagram.enabled,
    instagramTitle: social.instagram.title,
    instagramIntro: social.instagram.intro,
    instagramPosts: social.instagram.posts.map((post) => ({ url: instagramPostUrl(post) }))
  };
}

function valuesFromBody(body: Record<string, unknown>): SocialFormValues {
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const rawProfiles = body.profiles && typeof body.profiles === 'object' ? (body.profiles as Record<string, unknown>) : {};
  const rawPosts = body.instagramPosts;
  const postRows = Array.isArray(rawPosts) ? rawPosts : rawPosts && typeof rawPosts === 'object' ? Object.values(rawPosts) : [];
  return {
    profiles: Object.fromEntries(socialNetworkKeys.map((key) => [key, text(rawProfiles[key])])),
    instagramEnabled: Boolean(body.instagramEnabled),
    instagramTitle: text(body.instagramTitle),
    instagramIntro: text(body.instagramIntro),
    instagramPosts: postRows.map((row) => ({ url: text((row as Record<string, unknown> | null)?.url) }))
  };
}

const NETWORKS = socialNetworkKeys.map((key) => ({ key, label: SOCIAL_LABELS[key], host: SOCIAL_HOSTS[key][0] ?? '' }));

export class SocialAdminController {
  public static async editForm(_req: Request, res: Response): Promise<void> {
    render(res, 'social/edit', {
      pageTitle: 'Social Media',
      values: valuesFromSocial(await socialService.get()),
      networks: NETWORKS,
      postsMax: INSTAGRAM_POSTS_MAX
    });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renderInvalid = (message: string, fields: Record<string, string>): void => {
      res.status(422);
      render(res, 'social/edit', {
        pageTitle: 'Social Media',
        values: valuesFromBody(body),
        networks: NETWORKS,
        postsMax: INSTAGRAM_POSTS_MAX,
        error: message,
        errors: toRawRowFields(body.instagramPosts, 'instagramPosts', fields)
      });
    };
    const parsed = safeParseFields(socialFormSchema, body);
    if (!parsed.ok) {
      renderInvalid('Please correct the highlighted fields.', parsed.fields);
      return;
    }
    try {
      await socialService.update(parsed.data);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      renderInvalid(state.message, state.fields);
      return;
    }
    setFlash(req, 'success', 'Social media settings saved.');
    res.redirect('/admin/social');
  }
}
