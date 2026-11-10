import { z } from 'zod';
import { youtubeIdSchema } from '../domain/models.js';

const feedEntrySchema = z.object({
  id: youtubeIdSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().max(600),
  publishedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString())
});
export type FeedEntry = z.infer<typeof feedEntrySchema>;

const feedSchema = z.object({
  channelTitle: z.string().max(200),
  entries: z.array(feedEntrySchema).max(50)
});
export type ParsedFeed = z.infer<typeof feedSchema>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .trim();
}

function tag(xml: string, name: string): string {
  const escaped = name.replace(':', '\\:');
  const match = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`).exec(xml);
  return match?.[1] === undefined ? '' : decodeXml(match[1]);
}

function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) {
    return flat;
  }
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Parses the Atom feed at youtube.com/feeds/videos.xml into validated entries, newest first. */
export function parseYoutubeFeed(xml: string): ParsedFeed {
  if (!/<feed\b/.test(xml)) {
    throw new Error('The YouTube response is not a video feed.');
  }
  const head = xml.split(/<entry\b/)[0] ?? '';
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map((match) => {
    const body = match[1] ?? '';
    return {
      id: tag(body, 'yt:videoId'),
      title: shorten(tag(body, 'title'), 300),
      description: shorten(tag(body, 'media:description'), 600),
      publishedAt: tag(body, 'published')
    };
  });
  const parsed = feedSchema.safeParse({ channelTitle: shorten(tag(head, 'title'), 200), entries });
  if (!parsed.success) {
    throw new Error(`The YouTube feed did not have the expected shape (${parsed.error.issues[0]?.message ?? 'unknown problem'}).`);
  }
  return { ...parsed.data, entries: [...parsed.data.entries].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) };
}
