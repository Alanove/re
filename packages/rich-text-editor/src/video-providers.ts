/**
 * Allowlisted video embed providers for the rich-text editor video dialog.
 * Matchers extract an id and emit a fixed https embed URL — never the raw user URL.
 *
 * To add a provider: add a matcher here, allow the embed host in HtmlSanitizerService,
 * and add the same host to CspBaselineSources.FrameSrc.
 */

export interface VideoEmbedResult {
  success: true;
  provider: string;
  title: string;
  embed: string;
  embedSrc: string;
}

export interface VideoProvider {
  id: string;
  title: string;
  /** Return embedSrc when the URL matches this provider; otherwise null. */
  match: (url: string) => string | null;
}

function wrapEmbed(src: string, title: string): string {
  return (
    '<div class="rte-video">' +
    '<iframe src="' +
    src +
    '" title="' +
    title +
    '" allowfullscreen loading="lazy"></iframe></div>'
  );
}

export const VIDEO_PROVIDERS: VideoProvider[] = [
  {
    id: 'youtube',
    title: 'YouTube video',
    match(url) {
      const yt = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/i
      );
      return yt ? 'https://www.youtube.com/embed/' + yt[1] : null;
    },
  },
  {
    id: 'vimeo',
    title: 'Vimeo video',
    match(url) {
      const vim = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
      return vim ? 'https://player.vimeo.com/video/' + vim[1] : null;
    },
  },
];

/**
 * Build an allowlisted video embed from a user-supplied URL.
 * Returns null when the URL does not match a known provider.
 */
export function buildVideoEmbed(url: string | null | undefined): VideoEmbedResult | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  for (const provider of VIDEO_PROVIDERS) {
    const embedSrc = provider.match(trimmed);
    if (embedSrc) {
      return {
        success: true,
        provider: provider.id,
        title: provider.title,
        embedSrc,
        embed: wrapEmbed(embedSrc, provider.title),
      };
    }
  }

  return null;
}
