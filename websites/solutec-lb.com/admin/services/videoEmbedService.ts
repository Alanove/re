/**
 * Video Embed Service
 * Fetches video metadata from popular video platforms using oEmbed API
 */

interface VideoEmbedData {
  title: string;
  thumbnail: string;
  embed: string;
  description?: string;
  width?: number;
  height?: number;
  provider?: string;
}

export class VideoEmbedService {
  private static instance: VideoEmbedService;

  private constructor() {}

  public static getInstance(): VideoEmbedService {
    if (!VideoEmbedService.instance) {
      VideoEmbedService.instance = new VideoEmbedService();
    }
    return VideoEmbedService.instance;
  }

  /**
   * Extract video ID from YouTube URL
   */
  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract video ID from Vimeo URL
   */
  private extractVimeoVideoId(url: string): string | null {
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /vimeo\.com\/channels\/[^\/]+\/(\d+)/,
      /vimeo\.com\/groups\/[^\/]+\/videos\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract video ID from Rutube URL
   */
  private extractRutubeVideoId(url: string): string | null {
    const patterns = [
      /rutube\.ru\/video\/([a-zA-Z0-9]+)/,
      /rutube\.ru\/play\/embed\/([a-zA-Z0-9]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Detect video provider from URL
   */
  private detectProvider(url: string): 'youtube' | 'vimeo' | 'rutube' | null {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    if (url.includes('rutube.ru')) {
      return 'rutube';
    }
    return null;
  }

  /**
   * Check if a string is a URL
   */
  private isUrl(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }
    try {
      // Check if it starts with http/https or common URL patterns
      if (str.trim().match(/^(https?:\/\/|www\.|[a-z0-9-]+\.(com|ru|org|net|io|be))/i)) {
        return true;
      }
      // Try to parse as URL
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a string contains HTML/embed code
   */
  private isHtml(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }
    // Check for common HTML tags and embed patterns
    const htmlPattern = /<[^>]+>|&[a-z]+;|&#[0-9]+;/i;
    // Check for embed-specific patterns
    const embedPattern = /<div|<iframe|<embed|<object|class="video-wrapper"|style="position: relative/i;
    return htmlPattern.test(str) || embedPattern.test(str);
  }

  /**
   * Clean title - remove URL or HTML if it's accidentally returned as title
   */
  private cleanTitle(title: string | undefined, fallback: string): string {
    if (!title || typeof title !== 'string') {
      return fallback;
    }
    const trimmed = title.trim();
    // If title is a URL, use fallback
    if (this.isUrl(trimmed)) {
      return fallback;
    }
    // If title contains HTML/embed code, use fallback
    if (this.isHtml(trimmed)) {
      return fallback;
    }
    return trimmed;
  }

  /**
   * Fetch YouTube video metadata using oEmbed
   * Note: YouTube oEmbed API does not provide description field.
   * To get description, YouTube Data API v3 would be required (needs API key).
   */
  private async fetchYouTubeVideo(url: string, videoId: string): Promise<VideoEmbedData | null> {
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oEmbedUrl);

      if (!response.ok) {
        throw new Error(`YouTube oEmbed API returned ${response.status}`);
      }

      const data = await response.json();

      // Generate embed code with responsive wrapper
      const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

      return {
        title: this.cleanTitle(data.title, 'YouTube Video'),
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        embed: embed,
        width: data.width || 560,
        height: data.height || 315,
        provider: 'youtube'
      };
    } catch (error) {
      console.error('Error fetching YouTube video:', error);
      return null;
    }
  }

  /**
   * Fetch Vimeo video metadata using oEmbed
   */
  private async fetchVimeoVideo(url: string, videoId: string): Promise<VideoEmbedData | null> {
    try {
      const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const response = await fetch(oEmbedUrl);

      if (!response.ok) {
        throw new Error(`Vimeo oEmbed API returned ${response.status}`);
      }

      const data = await response.json();

      // Generate embed code with responsive wrapper
      const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="${data.embed_url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;

      return {
        title: this.cleanTitle(data.title, 'Vimeo Video'),
        thumbnail: data.thumbnail_url || '',
        embed: embed,
        description: data.description || undefined,
        width: data.width || 640,
        height: data.height || 360,
        provider: 'vimeo'
      };
    } catch (error) {
      console.error('Error fetching Vimeo video:', error);
      return null;
    }
  }

  /**
   * Fetch Rutube video metadata
   * Uses Rutube's API to get video information including thumbnail
   */
  private async fetchRutubeVideo(url: string, videoId: string): Promise<VideoEmbedData | null> {
    try {
      // Fetch video metadata from Rutube API
      const apiUrl = `https://rutube.ru/api/video/${videoId}/`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Rutube API returned ${response.status}`);
      }

      const data = await response.json();

      // Construct thumbnail URL
      // Rutube API returns thumbnail_url as a path, need to prepend the base URL
      let thumbnail = '';
      if (data.thumbnail_url) {
        // If thumbnail_url starts with http, use it directly, otherwise prepend base URL
        if (data.thumbnail_url.startsWith('http')) {
          thumbnail = data.thumbnail_url;
        } else {
          thumbnail = `https://pic.rutube.ru${data.thumbnail_url}`;
        }
      }

      // Generate embed code with responsive wrapper
      const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="https://rutube.ru/play/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;

      return {
        title: this.cleanTitle(data.title, 'Rutube Video'),
        thumbnail: thumbnail,
        embed: embed,
        description: data.description || undefined,
        width: data.width || 640,
        height: data.height || 360,
        provider: 'rutube'
      };
    } catch (error) {
      console.error('Error fetching Rutube video:', error);
      // Fallback: return embed without thumbnail if API fails
      const embed = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;"><iframe src="https://rutube.ru/play/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      
      return {
        title: 'Rutube Video',
        thumbnail: '',
        embed: embed,
        width: 640,
        height: 360,
        provider: 'rutube'
      };
    }
  }

  /**
   * Fetch video metadata from URL
   */
  public async fetchVideoMetadata(url: string): Promise<VideoEmbedData | null> {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const provider = this.detectProvider(url);

    if (!provider) {
      return null;
    }

    if (provider === 'youtube') {
      const videoId = this.extractYouTubeVideoId(url);
      if (!videoId) {
        return null;
      }
      return await this.fetchYouTubeVideo(url, videoId);
    }

    if (provider === 'vimeo') {
      const videoId = this.extractVimeoVideoId(url);
      if (!videoId) {
        return null;
      }
      return await this.fetchVimeoVideo(url, videoId);
    }

    if (provider === 'rutube') {
      const videoId = this.extractRutubeVideoId(url);
      if (!videoId) {
        return null;
      }
      return await this.fetchRutubeVideo(url, videoId);
    }

    return null;
  }
}

export const videoEmbedService = VideoEmbedService.getInstance();

