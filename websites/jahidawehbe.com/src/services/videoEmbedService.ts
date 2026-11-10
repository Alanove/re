import { BadRequestError } from '../errors/httpError.js';

export interface VideoEmbed {
  provider: 'youtube' | 'vimeo';
  title: string;
  thumbnail: string;
  embed: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const match = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(url.pathname);
      candidate = match?.[1] ?? null;
    }
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/** Reads the video id from any YouTube watch, share, embed, shorts or live link. */
export function parseYoutubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? youtubeId(url) : null;
  } catch {
    return null;
  }
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^player\./, '');
  if (host !== 'vimeo.com') {
    return null;
  }
  const match = /\/(?:video\/)?(\d{5,12})(?:$|[/?#])/.exec(url.pathname);
  return match?.[1] ?? null;
}

export class VideoEmbedService {
  public resolve(rawUrl: string): VideoEmbed {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestError('Enter a valid YouTube or Vimeo link.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequestError('Enter a valid YouTube or Vimeo link.');
    }
    const yt = youtubeId(url);
    if (yt) {
      return {
        provider: 'youtube',
        title: 'YouTube video',
        thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
        embed: `<iframe src="https://www.youtube.com/embed/${yt}" width="560" height="315" title="YouTube video" allowfullscreen></iframe>`
      };
    }
    const vm = vimeoId(url);
    if (vm) {
      return {
        provider: 'vimeo',
        title: 'Vimeo video',
        thumbnail: '',
        embed: `<iframe src="https://player.vimeo.com/video/${vm}" width="560" height="315" title="Vimeo video" allowfullscreen></iframe>`
      };
    }
    throw new BadRequestError('Only YouTube and Vimeo links are supported.');
  }
}

export const videoEmbedService = new VideoEmbedService();
