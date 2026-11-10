import { emptySocialProfiles } from '../domain/defaults.js';
import { instagramCodeSchema, socialNetworkKeys, type InstagramPost, type Social, type SocialNetworkKey } from '../domain/models.js';
import { BadRequestError } from '../errors/httpError.js';
import { socialRepository } from '../repositories/singletonRepositories.js';

export interface SocialLink {
  key: SocialNetworkKey;
  label: string;
  url: string;
  handle: string;
}

export interface InstagramEmbed extends InstagramPost {
  url: string;
  embedUrl: string;
}

export interface SocialInput {
  profiles: Record<SocialNetworkKey, string>;
  instagramEnabled: boolean;
  instagramTitle: string;
  instagramIntro: string;
  instagramPosts: { url: string }[];
}

export const SOCIAL_LABELS: Record<SocialNetworkKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  spotify: 'Spotify',
  anghami: 'Anghami',
  appleMusic: 'Apple Music',
  deezer: 'Deezer'
};

/** Hosts each profile link must point at, so a typo cannot send visitors elsewhere. */
export const SOCIAL_HOSTS: Record<SocialNetworkKey, string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
  x: ['x.com', 'twitter.com'],
  spotify: ['open.spotify.com', 'spotify.com', 'spotify.link'],
  anghami: ['anghami.com', 'play.anghami.com'],
  appleMusic: ['music.apple.com'],
  deezer: ['deezer.com', 'deezer.page.link']
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

export function isSocialHost(key: SocialNetworkKey, url: string): boolean {
  const host = hostOf(url);
  return SOCIAL_HOSTS[key].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function handleOf(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const last = segments.find((segment) => !['c', 'user', 'channel', 'artist', 'pages'].includes(segment)) ?? '';
    return last ? `@${decodeURIComponent(last).replace(/^@/, '')}` : '';
  } catch {
    return '';
  }
}

/** Reads the shortcode from an Instagram post, reel or IGTV link. */
export function parseInstagramUrl(raw: string): { code: string; kind: 'p' | 'reel' } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || hostOf(url.href) !== 'instagram.com') {
    return null;
  }
  const match = /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([^/?#]+)/.exec(url.pathname);
  if (!match?.[2] || !instagramCodeSchema.safeParse(match[2]).success) {
    return null;
  }
  return { code: match[2], kind: match[1] === 'p' || match[1] === 'tv' ? 'p' : 'reel' };
}

export function instagramPostUrl(post: Pick<InstagramPost, 'code' | 'kind'>): string {
  return `https://www.instagram.com/${post.kind}/${post.code}/`;
}

export class SocialService {
  public async get(): Promise<Social> {
    return socialRepository.get();
  }

  public links(social: Social): SocialLink[] {
    return socialNetworkKeys.flatMap((key) => {
      const url = social.profiles[key] ?? '';
      return url ? [{ key, label: SOCIAL_LABELS[key], url, handle: handleOf(url) }] : [];
    });
  }

  public instagramEmbeds(social: Social): InstagramEmbed[] {
    return social.instagram.posts.map((post) => ({
      ...post,
      url: instagramPostUrl(post),
      embedUrl: `https://www.instagram.com/${post.kind}/${post.code}/embed/`
    }));
  }

  public async update(input: SocialInput): Promise<Social> {
    const fields: Record<string, string> = {};
    for (const key of socialNetworkKeys) {
      const url = input.profiles[key];
      if (url && !isSocialHost(key, url)) {
        fields[`profiles.${key}`] = `Use a ${SOCIAL_LABELS[key]} link (${SOCIAL_HOSTS[key][0] ?? ''})`;
      }
    }
    const previous = new Map((await socialRepository.get()).instagram.posts.map((post) => [post.code, post]));
    const now = new Date().toISOString();
    const posts: InstagramPost[] = [];
    input.instagramPosts.forEach((row, index) => {
      const parsed = parseInstagramUrl(row.url);
      if (!parsed) {
        fields[`instagramPosts.${index}.url`] = 'Paste a post or reel link such as https://www.instagram.com/p/…/';
        return;
      }
      if (posts.some((post) => post.code === parsed.code)) {
        fields[`instagramPosts.${index}.url`] = 'This post is already in the list';
        return;
      }
      posts.push({ ...parsed, addedAt: previous.get(parsed.code)?.addedAt ?? now });
    });
    if (Object.keys(fields).length > 0) {
      throw new BadRequestError('Please correct the highlighted fields.', fields);
    }
    return socialRepository.update(() => ({
      profiles: { ...emptySocialProfiles(), ...input.profiles },
      instagram: { enabled: input.instagramEnabled, title: input.instagramTitle, intro: input.instagramIntro, posts },
      updatedAt: now
    }));
  }
}

export const socialService = new SocialService();
