const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml';
const OEMBED_URL = 'https://www.youtube.com/oembed';
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JahidaWehbeVideoSync/1.0; +https://jahidawehbe.com)',
  'Accept-Language': 'en;q=0.9,ar;q=0.8'
};
const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com']);

export class YoutubeSourceError extends Error {}

/** Reads public YouTube endpoints that need no API key: the channel RSS feed, channel pages and oEmbed. */
export class YoutubeFeedSource {
  public feedUrl(channelId: string): string {
    return `${FEED_URL}?channel_id=${encodeURIComponent(channelId)}`;
  }

  public async fetchFeed(channelId: string): Promise<string> {
    const response = await this.request(this.feedUrl(channelId), 'application/atom+xml,application/xml,text/xml');
    if (response.status === 404) {
      throw new YoutubeSourceError('YouTube does not know this channel id. Check it under Admin > Videos.');
    }
    if (!response.ok) {
      throw new YoutubeSourceError(`YouTube answered the feed request with HTTP ${response.status}.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/xml/i.test(contentType)) {
      throw new YoutubeSourceError(`YouTube returned "${contentType || 'no content type'}" instead of the video feed.`);
    }
    return this.readLimited(response);
  }

  /** Finds the UC… channel id behind a channel link such as /@name, /c/name or /user/name. */
  public async resolveChannelId(channelUrl: string): Promise<string> {
    let url: URL;
    try {
      url = new URL(channelUrl);
    } catch {
      throw new YoutubeSourceError('Enter a full YouTube channel link, for example https://www.youtube.com/@name.');
    }
    if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname.replace(/^www\./, ''))) {
      throw new YoutubeSourceError('Only https://www.youtube.com channel links can be looked up.');
    }
    const direct = /^\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(url.pathname)?.[1];
    if (direct) {
      return direct;
    }
    const response = await this.request(`https://www.youtube.com${url.pathname}`, 'text/html');
    if (!response.ok) {
      throw new YoutubeSourceError(`YouTube answered the channel lookup with HTTP ${response.status}.`);
    }
    const html = await this.readLimited(response);
    const match =
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/.exec(html) ??
      /"externalId":"(UC[A-Za-z0-9_-]{22})"/.exec(html) ??
      /"channelId":"(UC[A-Za-z0-9_-]{22})"/.exec(html);
    if (!match?.[1]) {
      throw new YoutubeSourceError('The channel id could not be found on that page. Paste the id that starts with UC instead.');
    }
    return match[1];
  }

  /** Returns the public title of a video, or null when YouTube does not answer (private, removed or offline). */
  public async fetchTitle(videoId: string): Promise<string | null> {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    try {
      const response = await this.request(`${OEMBED_URL}?url=${encodeURIComponent(watchUrl)}&format=json`, 'application/json');
      if (!response.ok) {
        return null;
      }
      const data = JSON.parse(await this.readLimited(response)) as { title?: unknown };
      return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
    } catch {
      return null;
    }
  }

  private async request(url: string, accept: string): Promise<Response> {
    try {
      return await fetch(url, { headers: { ...REQUEST_HEADERS, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error && error.name === 'TimeoutError' ? `no answer within ${REQUEST_TIMEOUT_MS / 1000} s` : error instanceof Error ? error.message : String(error);
      throw new YoutubeSourceError(`YouTube could not be reached (${reason}).`);
    }
  }

  private async readLimited(response: Response): Promise<string> {
    if (!response.body) {
      throw new YoutubeSourceError('YouTube returned an empty response.');
    }
    const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new YoutubeSourceError('The YouTube response is larger than expected and was not read.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

export const youtubeFeedSource = new YoutubeFeedSource();
