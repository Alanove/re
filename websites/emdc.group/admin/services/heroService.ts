import * as fs from 'fs';
import * as path from 'path';
import { DATA_PATHS } from '../../src/constants/data-paths';

export interface HeroQuote {
  id: number;
  text: string;
  author: string;
  active: boolean;
}

export interface HeroVideo {
  filename: string;
  backgroundType: 'light' | 'dark';
}

export interface HeroSectionData {
  currentVideo: string;
  quotes: HeroQuote[];
  availableVideos: HeroVideo[];
}

export class HeroService {
  private static instance: HeroService;
  private data: HeroSectionData;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): HeroService {
    if (!HeroService.instance) {
      HeroService.instance = new HeroService();
    }
    return HeroService.instance;
  }

  /**
   * Load hero section data from JSON file
   */
  private loadData(): HeroSectionData {
    try {
      if (fs.existsSync(DATA_PATHS.HERO_SECTION_FILE)) {
        const data = fs.readFileSync(DATA_PATHS.HERO_SECTION_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading hero section data:', error);
    }

    // Return default data if file doesn't exist or is invalid
    return {
      currentVideo: 'home4_yoyo_compressed.mp4',
      quotes: [],
      availableVideos: []
    };
  }

  /**
   * Save hero section data to JSON file
   */
  private saveData(): void {
    try {
      fs.writeFileSync(DATA_PATHS.HERO_SECTION_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving hero section data:', error);
      throw new Error('Failed to save hero section data');
    }
  }

  /**
   * Get all hero section data
   */
  public getHeroSectionData(): HeroSectionData {
    return { ...this.data };
  }

  /**
   * Get current video
   */
  public getCurrentVideo(): string {
    return this.data.currentVideo;
  }

  /**
   * Set current video
   */
  public setCurrentVideo(videoName: string): void {
    if (this.data.availableVideos.some(video => video.filename === videoName)) {
      this.data.currentVideo = videoName;
      this.saveData();
    } else {
      throw new Error('Video not found in available videos');
    }
  }

  /**
   * Get all quotes
   */
  public getAllQuotes(): HeroQuote[] {
    return [...this.data.quotes];
  }

  /**
   * Get active quotes only
   */
  public getActiveQuotes(): HeroQuote[] {
    return this.data.quotes.filter(quote => quote.active);
  }

  /**
   * Add a new quote
   */
  public addQuote(text: string, author: string): HeroQuote {
    const newId = Math.max(...this.data.quotes.map(q => q.id), 0) + 1;
    const newQuote: HeroQuote = {
      id: newId,
      text,
      author,
      active: true
    };
    
    this.data.quotes.push(newQuote);
    this.saveData();
    return newQuote;
  }

  /**
   * Update a quote
   */
  public updateQuote(id: number, text: string, author: string, active: boolean): HeroQuote {
    const quoteIndex = this.data.quotes.findIndex(q => q.id === id);
    if (quoteIndex === -1) {
      throw new Error('Quote not found');
    }

    this.data.quotes[quoteIndex] = {
      id,
      text,
      author,
      active
    };
    
    this.saveData();
    return this.data.quotes[quoteIndex];
  }

  /**
   * Delete a quote
   */
  public deleteQuote(id: number): void {
    const quoteIndex = this.data.quotes.findIndex(q => q.id === id);
    if (quoteIndex === -1) {
      throw new Error('Quote not found');
    }

    this.data.quotes.splice(quoteIndex, 1);
    this.saveData();
  }

  /**
   * Get available videos
   */
  public getAvailableVideos(): HeroVideo[] {
    return [...this.data.availableVideos];
  }

  /**
   * Get current video background type
   */
  public getCurrentVideoBackgroundType(): 'light' | 'dark' {
    const currentVideo = this.data.availableVideos.find(video => video.filename === this.data.currentVideo);
    return currentVideo ? currentVideo.backgroundType : 'dark';
  }

  /**
   * Refresh available videos from the videos directory
   */
  public refreshAvailableVideos(): HeroVideo[] {
    try {
      if (fs.existsSync(DATA_PATHS.VIDEOS_DIR)) {
        const files = fs.readdirSync(DATA_PATHS.VIDEOS_DIR);
        const videoFiles = files.filter(file => 
          file.toLowerCase().endsWith('.mp4') || 
          file.toLowerCase().endsWith('.webm') || 
          file.toLowerCase().endsWith('.ogg')
        );
        
        // Convert to new format, preserving existing background types
        const existingVideos = this.data.availableVideos;
        this.data.availableVideos = videoFiles.map(filename => {
          const existing = existingVideos.find(video => video.filename === filename);
          return {
            filename,
            backgroundType: existing ? existing.backgroundType : 'dark'
          };
        });
        
        this.saveData();
        return this.data.availableVideos;
      }
    } catch (error) {
      console.error('Error refreshing available videos:', error);
    }
    
    return [];
  }

  /**
   * Upload a new video file
   */
  public addVideoFile(filename: string): void {
    if (!this.data.availableVideos.some(video => video.filename === filename)) {
      this.data.availableVideos.push({
        filename,
        backgroundType: 'dark'
      });
      this.saveData();
    }
  }

  /**
   * Remove a video file from available videos
   */
  public removeVideoFile(filename: string): void {
    const index = this.data.availableVideos.findIndex(video => video.filename === filename);
    if (index > -1) {
      this.data.availableVideos.splice(index, 1);
      
      // If this was the current video, reset to default
      if (this.data.currentVideo === filename) {
        this.data.currentVideo = this.data.availableVideos[0]?.filename || 'home4_yoyo_compressed.mp4';
      }
      
      this.saveData();
    }
  }

  /**
   * Update video background type
   */
  public updateVideoBackgroundType(filename: string, backgroundType: 'light' | 'dark'): void {
    const video = this.data.availableVideos.find(v => v.filename === filename);
    if (video) {
      video.backgroundType = backgroundType;
      this.saveData();
    }
  }

  /**
   * Get hero section statistics
   */
  public getStatistics(): { totalQuotes: number; activeQuotes: number; totalVideos: number; currentVideo: string } {
    return {
      totalQuotes: this.data.quotes.length,
      activeQuotes: this.data.quotes.filter(q => q.active).length,
      totalVideos: this.data.availableVideos.length,
      currentVideo: this.data.currentVideo
    };
  }
}
