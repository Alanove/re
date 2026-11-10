import { env } from '../config/env.js';
import { VIDEOS_MAX, youtubeChannelIdSchema, youtubeIdSchema, type Video, type VideoLibrary } from '../domain/models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/httpError.js';
import { videoLibraryRepository, type VideoLibraryRepository } from '../repositories/singletonRepositories.js';
import { youtubeFeedSource, type YoutubeFeedSource } from '../repositories/youtubeFeedSource.js';
import { parseYoutubeId } from './videoEmbedService.js';
import { parseYoutubeFeed } from './youtubeFeedParser.js';

const MAX_ERROR_LENGTH = 500;
const BOOT_DELAY_MS = 8_000;

export interface PublicVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string | null;
  dateLabel: string;
  thumbnail: string;
  thumbnailLarge: string;
  watchUrl: string;
  embedUrl: string;
  pinned: boolean;
}

export interface VideoSyncStatus {
  healthy: boolean;
  channelId: string;
  feedUrl: string;
  syncEnabled: boolean;
  schedulerEnabled: boolean;
  intervalMinutes: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangeAt: string | null;
  lastError: string;
  lastCount: number;
  summary: string;
}

export interface VideoSyncResult {
  ok: boolean;
  added: number;
  message: string;
}

export interface VideoChannelInput {
  channel: string;
  syncEnabled: boolean;
}

export interface VideoAddInput {
  url: string;
  title: string;
}

export interface VideoLibraryInput {
  featured: string;
  items: { id: string; title: string; sort: number; hidden: boolean; remove: boolean }[];
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function relativeTime(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

/** Featured video first, then the editor's order, then newest first. */
export function compareVideos(a: Video, b: Video): number {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  if (a.sort !== b.sort) {
    return a.sort - b.sort;
  }
  const dateA = a.publishedAt ?? a.addedAt;
  const dateB = b.publishedAt ?? b.addedAt;
  return dateB.localeCompare(dateA) || a.id.localeCompare(b.id);
}

export function toPublicVideo(video: Video): PublicVideo {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    publishedAt: video.publishedAt,
    dateLabel: video.publishedAt ? dateFormat.format(new Date(video.publishedAt)) : '',
    thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    thumbnailLarge: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${video.id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
    pinned: video.pinned
  };
}

/** Keeps the library within VIDEOS_MAX by dropping the oldest unpinned feed videos. */
function trimLibrary(items: Video[]): Video[] {
  if (items.length <= VIDEOS_MAX) {
    return items;
  }
  const removable = items
    .filter((item) => item.source === 'feed' && !item.pinned)
    .sort((a, b) => (a.publishedAt ?? a.addedAt).localeCompare(b.publishedAt ?? b.addedAt));
  const drop = new Set(removable.slice(0, items.length - VIDEOS_MAX).map((item) => item.id));
  return items.filter((item) => !drop.has(item.id)).slice(0, VIDEOS_MAX);
}

export class VideoService {
  private running: Promise<VideoSyncResult> | null = null;

  public constructor(
    private readonly repository: VideoLibraryRepository,
    private readonly source: YoutubeFeedSource
  ) {}

  public async listPublic(limit?: number): Promise<PublicVideo[]> {
    const { items } = await this.repository.get();
    const visible = items.filter((item) => !item.hidden).sort(compareVideos);
    return (limit === undefined ? visible : visible.slice(0, limit)).map(toPublicVideo);
  }

  public async getLibrary(): Promise<VideoLibrary> {
    const library = await this.repository.get();
    return { ...library, items: [...library.items].sort(compareVideos) };
  }

  public async status(now = new Date()): Promise<VideoSyncStatus> {
    const { channelId, sync } = await this.repository.get();
    let summary: string;
    if (!channelId) {
      summary = 'Add the YouTube channel to start syncing';
    } else if (!env.YOUTUBE_SYNC_ENABLED) {
      summary = 'Automatic sync is switched off on this server';
    } else if (!sync.enabled) {
      summary = 'Automatic sync is paused';
    } else if (sync.lastError) {
      summary = `Last sync failed ${sync.lastAttemptAt ? relativeTime(sync.lastAttemptAt, now) : ''}`.trim();
    } else if (sync.lastSuccessAt) {
      summary = `Checked YouTube ${relativeTime(sync.lastSuccessAt, now)}`;
    } else {
      summary = 'Waiting for the first sync';
    }
    return {
      healthy: channelId !== '' && sync.lastError === '',
      channelId,
      feedUrl: channelId ? this.source.feedUrl(channelId) : '',
      syncEnabled: sync.enabled,
      schedulerEnabled: env.YOUTUBE_SYNC_ENABLED,
      intervalMinutes: env.YOUTUBE_SYNC_MINUTES,
      lastAttemptAt: sync.lastAttemptAt,
      lastSuccessAt: sync.lastSuccessAt,
      lastChangeAt: sync.lastChangeAt,
      lastError: sync.lastError,
      lastCount: sync.lastCount,
      summary
    };
  }

  public async updateChannel(input: VideoChannelInput): Promise<VideoLibrary> {
    let channelId = '';
    if (input.channel) {
      const direct = youtubeChannelIdSchema.safeParse(input.channel);
      try {
        channelId = direct.success ? direct.data : await this.source.resolveChannelId(input.channel);
      } catch (error) {
        throw new BadRequestError('Please correct the highlighted fields.', { channel: error instanceof Error ? error.message : String(error) });
      }
    }
    return this.repository.update((current) => ({
      ...current,
      channelId,
      sync: {
        ...current.sync,
        enabled: input.syncEnabled,
        lastError: channelId === current.channelId ? current.sync.lastError : ''
      },
      updatedAt: new Date().toISOString()
    }));
  }

  public async addVideo(input: VideoAddInput): Promise<Video> {
    const id = parseYoutubeId(input.url) ?? (youtubeIdSchema.safeParse(input.url).success ? input.url : null);
    if (!id || !youtubeIdSchema.safeParse(id).success) {
      throw new BadRequestError('Please correct the highlighted fields.', { url: 'Paste a YouTube video link, for example https://www.youtube.com/watch?v=…' });
    }
    const existing = (await this.repository.get()).items.find((item) => item.id === id);
    if (existing) {
      throw new ConflictError('Please correct the highlighted fields.', { url: `This video is already in the library as "${existing.title}".` });
    }
    const title = input.title || (await this.source.fetchTitle(id));
    if (!title) {
      throw new BadRequestError('Please correct the highlighted fields.', { title: 'YouTube did not return a title for this video. Type one here.' });
    }
    const now = new Date().toISOString();
    const video: Video = { id, title: title.slice(0, 300), description: '', publishedAt: null, source: 'manual', pinned: false, hidden: false, sort: 0, addedAt: now };
    await this.repository.update((current) => {
      if (current.items.some((item) => item.id === id)) {
        throw new ConflictError('Please correct the highlighted fields.', { url: 'This video is already in the library.' });
      }
      if (current.items.length >= VIDEOS_MAX) {
        throw new BadRequestError(`The library holds at most ${VIDEOS_MAX} videos. Remove or hide older ones first.`);
      }
      return { ...current, items: [...current.items, video], updatedAt: now };
    });
    return video;
  }

  public async updateLibrary(input: VideoLibraryInput): Promise<VideoLibrary> {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestError('Each video can only appear once.');
    }
    if (input.featured && !ids.includes(input.featured)) {
      throw new BadRequestError('The featured video is not in the list.');
    }
    const now = new Date().toISOString();
    return this.repository.update((current) => {
      const byId = new Map(input.items.map((item) => [item.id, item]));
      const missing = ids.find((id) => !current.items.some((item) => item.id === id));
      if (missing) {
        throw new NotFoundError(`Video ${missing} is no longer in the library. Reload the page and try again.`);
      }
      const items = current.items.flatMap((video): Video[] => {
        const change = byId.get(video.id);
        if (!change) {
          return [{ ...video, pinned: input.featured === video.id }];
        }
        if (change.remove && video.source === 'manual') {
          return [];
        }
        const hidden = change.remove ? true : change.hidden;
        return [{ ...video, title: change.title, sort: change.sort, hidden, pinned: input.featured === video.id && !hidden }];
      });
      return { ...current, items, updatedAt: now };
    });
  }

  /** Runs one sync. Concurrent callers share the run in progress instead of hitting YouTube twice. */
  public syncNow(): Promise<VideoSyncResult> {
    this.running ??= this.runSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Starts the background schedule and returns a function that stops it. Does nothing when the server switch is off. */
  public startScheduler(): () => void {
    if (!env.YOUTUBE_SYNC_ENABLED) {
      console.info('YouTube sync: switched off by YOUTUBE_SYNC_ENABLED');
      return () => undefined;
    }
    const tick = async (): Promise<void> => {
      try {
        const { channelId, sync } = await this.repository.get();
        if (!channelId || !sync.enabled) {
          return;
        }
        const result = await this.syncNow();
        if (!result.ok) {
          console.warn(`YouTube sync: ${result.message}`);
        }
      } catch (error) {
        console.error('YouTube sync crashed', error);
      }
    };
    const first = setTimeout(() => void tick(), BOOT_DELAY_MS);
    const interval = setInterval(() => void tick(), env.YOUTUBE_SYNC_MINUTES * 60_000);
    first.unref();
    interval.unref();
    console.info(`YouTube sync: every ${env.YOUTUBE_SYNC_MINUTES} min`);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }

  private async runSync(): Promise<VideoSyncResult> {
    const attemptAt = new Date().toISOString();
    const { channelId } = await this.repository.get();
    if (!channelId) {
      return { ok: false, added: 0, message: 'Add the YouTube channel first.' };
    }
    let entries: ReturnType<typeof parseYoutubeFeed>['entries'];
    try {
      entries = parseYoutubeFeed(await this.source.fetchFeed(channelId)).entries;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
      await this.repository.update((current) => ({ ...current, sync: { ...current.sync, lastAttemptAt: attemptAt, lastError: message } }));
      return { ok: false, added: 0, message: `${message} The videos already on the website stay as they are.` };
    }

    let added = 0;
    await this.repository.update((current) => {
      const byId = new Map(current.items.map((item) => [item.id, item]));
      for (const entry of entries) {
        const known = byId.get(entry.id);
        if (known) {
          byId.set(entry.id, { ...known, publishedAt: known.publishedAt ?? entry.publishedAt, description: known.description || entry.description });
        } else {
          added += 1;
          byId.set(entry.id, {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            publishedAt: entry.publishedAt,
            source: 'feed',
            pinned: false,
            hidden: false,
            sort: 0,
            addedAt: attemptAt
          });
        }
      }
      return {
        ...current,
        items: trimLibrary([...byId.values()]),
        sync: {
          ...current.sync,
          lastAttemptAt: attemptAt,
          lastSuccessAt: attemptAt,
          lastChangeAt: added > 0 ? attemptAt : current.sync.lastChangeAt,
          lastError: '',
          lastCount: entries.length
        },
        updatedAt: added > 0 ? attemptAt : current.updatedAt
      };
    });
    return {
      ok: true,
      added,
      message: added > 0 ? `${added} new video${added === 1 ? ' was' : 's were'} added from YouTube.` : `The library is up to date (${entries.length} videos in the channel feed).`
    };
  }
}

export const videoService = new VideoService(videoLibraryRepository, youtubeFeedSource);
