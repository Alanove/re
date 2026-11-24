import { DATA_FILES } from '../config/paths.js';
import { videosFileSchema, type Video } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class VideosRepository {
  private readonly store = new JsonFileStore<Video[]>(DATA_FILES.videos, videosFileSchema, () => []);

  public async findAll(): Promise<Video[]> {
    return this.store.read();
  }

  public async replaceAll(videos: Video[]): Promise<void> {
    await this.store.write(videos);
  }

  public async save(video: Video): Promise<Video> {
    return this.store.update((videos) => {
      const index = videos.findIndex((item) => item.id === video.id);
      const next = [...videos];
      if (index === -1) {
        next.push(video);
      } else {
        next[index] = video;
      }
      return { next, result: video };
    });
  }

  public async insert(video: Omit<Video, 'id'>): Promise<Video> {
    return this.store.update((videos) => {
      const id = videos.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const created: Video = { ...video, id };
      return { next: [...videos, created], result: created };
    });
  }

  public async remove(id: number): Promise<Video | null> {
    return this.store.update((videos) => {
      const existing = videos.find((item) => item.id === id) ?? null;
      return { next: videos.filter((item) => item.id !== id), result: existing };
    });
  }
}

export const videosRepository = new VideosRepository();
