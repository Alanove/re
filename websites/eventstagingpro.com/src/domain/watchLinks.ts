const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function youtubeIdFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
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

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Canonical https Facebook video URL, or null when the link is not a video. */
export function facebookWatchUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^web\./, '');
  if (host !== 'facebook.com' && host !== 'fb.watch') {
    return null;
  }
  if (host === 'fb.watch' || /\/videos\//i.test(url.pathname) || url.searchParams.has('v')) {
    url.protocol = 'https:';
    return url.toString();
  }
  return null;
}

export function facebookPluginUrl(watchUrl: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(watchUrl)}&show_text=false&width=1140`;
}
