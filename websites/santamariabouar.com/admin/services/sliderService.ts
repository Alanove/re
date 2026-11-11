import { db } from '../../src/config/database';

export interface Slide {
  id: string;
  image: string;
  alt: string;
  order: number;
  active: boolean;
  title?: string;
  link?: string;
  buttonText?: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  posterImage?: string;
}

export class SliderService {
  private static instance: SliderService;

  private constructor() {}

  public static getInstance(): SliderService {
    if (!SliderService.instance) {
      SliderService.instance = new SliderService();
    }
    return SliderService.instance;
  }

  public reloadData(): void {
    // Cache clearing - not needed for SQL version
  }

  public async getAllSlides(): Promise<Slide[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          image_url as image,
          subtitle as alt,
          order_index as \`order\`,
          is_active as active,
          title,
          link_url as link,
          link_text as buttonText,
          media_type as mediaType,
          video_url as videoUrl,
          poster_image as posterImage
        FROM slider
        ORDER BY order_index
      `);
      return rows as Slide[];
    } catch (error) {
      console.error('Error fetching slides:', error);
      return [];
    }
  }

  public async getActiveSlides(): Promise<Slide[]> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          image_url as image,
          subtitle as alt,
          order_index as \`order\`,
          is_active as active,
          title,
          link_url as link,
          link_text as buttonText,
          media_type as mediaType,
          video_url as videoUrl,
          poster_image as posterImage
        FROM slider
        WHERE is_active = 1
        ORDER BY order_index
      `);
      return rows as Slide[];
    } catch (error) {
      console.error('Error fetching active slides:', error);
      return [];
    }
  }

  public async getSlideById(id: string): Promise<Slide | null> {
    try {
      const [rows] = await db.query(`
        SELECT 
          CAST(id AS CHAR) as id,
          image_url as image,
          subtitle as alt,
          order_index as \`order\`,
          is_active as active,
          title,
          link_url as link,
          link_text as buttonText,
          media_type as mediaType,
          video_url as videoUrl,
          poster_image as posterImage
        FROM slider
        WHERE id = ?
      `, [id]);
      
      const results = rows as any[];
      return results[0] || null;
    } catch (error) {
      console.error('Error fetching slide by ID:', error);
      return null;
    }
  }

  public async addSlide(image: string, alt: string, order?: number, title?: string, link?: string, buttonText?: string, mediaType?: 'image' | 'video', videoUrl?: string, posterImage?: string): Promise<Slide> {
    try {
      const [result] = await db.query(`
        INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `, [image, title || '', alt, order || 0, link || '', buttonText || '', mediaType || 'image', videoUrl || null, posterImage || null]);
      
      const insertId = (result as any).insertId;
      const slide = await this.getSlideById(insertId.toString());
      if (!slide) throw new Error('Failed to retrieve created slide');
      return slide;
    } catch (error) {
      console.error('Error adding slide:', error);
      throw new Error('Failed to add slide');
    }
  }

  public async updateSlide(id: string, updates: Partial<Omit<Slide, 'id'>>): Promise<Slide | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (updates.image !== undefined) {
        updateFields.push('image_url = ?');
        values.push(updates.image);
      }
      if (updates.alt !== undefined) {
        updateFields.push('subtitle = ?');
        values.push(updates.alt);
      }
      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.link !== undefined) {
        updateFields.push('link_url = ?');
        values.push(updates.link);
      }
      if (updates.buttonText !== undefined) {
        updateFields.push('link_text = ?');
        values.push(updates.buttonText);
      }
      if (updates.order !== undefined) {
        updateFields.push('order_index = ?');
        values.push(updates.order);
      }
      if (updates.active !== undefined) {
        updateFields.push('is_active = ?');
        values.push(updates.active ? 1 : 0);
      }
      if (updates.mediaType !== undefined) {
        updateFields.push('media_type = ?');
        values.push(updates.mediaType);
      }
      if (updates.videoUrl !== undefined) {
        updateFields.push('video_url = ?');
        values.push(updates.videoUrl);
      }
      if (updates.posterImage !== undefined) {
        updateFields.push('poster_image = ?');
        values.push(updates.posterImage);
      }

      if (updateFields.length === 0) {
        return await this.getSlideById(id);
      }

      values.push(id);
      await db.query(`
        UPDATE slider
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      
      return await this.getSlideById(id);
    } catch (error) {
      console.error('Error updating slide:', error);
      return null;
    }
  }

  public async deleteSlide(id: string): Promise<boolean> {
    try {
      const [result] = await db.query(`
        DELETE FROM slider WHERE id = ?
      `, [id]);
      
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting slide:', error);
      return false;
    }
  }

  public async moveSlideUp(id: string): Promise<boolean> {
    try {
      // Get current slide
      const currentSlide = await this.getSlideById(id);
      if (!currentSlide) return false;

      // Get all slides ordered by order_index
      const allSlides = await this.getAllSlides();
      
      // Find current slide index
      const currentIndex = allSlides.findIndex(s => s.id === id);
      if (currentIndex <= 0) return false; // Already at top or not found

      // Get the slide above
      const slideAbove = allSlides[currentIndex - 1];

      // Swap order_index values
      await db.query(`
        UPDATE slider SET order_index = ? WHERE id = ?
      `, [slideAbove.order, currentSlide.id]);

      await db.query(`
        UPDATE slider SET order_index = ? WHERE id = ?
      `, [currentSlide.order, slideAbove.id]);

      return true;
    } catch (error) {
      console.error('Error moving slide up:', error);
      return false;
    }
  }

  public async moveSlideDown(id: string): Promise<boolean> {
    try {
      // Get current slide
      const currentSlide = await this.getSlideById(id);
      if (!currentSlide) return false;

      // Get all slides ordered by order_index
      const allSlides = await this.getAllSlides();
      
      // Find current slide index
      const currentIndex = allSlides.findIndex(s => s.id === id);
      if (currentIndex < 0 || currentIndex >= allSlides.length - 1) return false; // Already at bottom or not found

      // Get the slide below
      const slideBelow = allSlides[currentIndex + 1];

      // Swap order_index values
      await db.query(`
        UPDATE slider SET order_index = ? WHERE id = ?
      `, [slideBelow.order, currentSlide.id]);

      await db.query(`
        UPDATE slider SET order_index = ? WHERE id = ?
      `, [currentSlide.order, slideBelow.id]);

      return true;
    } catch (error) {
      console.error('Error moving slide down:', error);
      return false;
    }
  }

  public async toggleSlideActive(id: string): Promise<boolean> {
    try {
      const slide = await this.getSlideById(id);
      if (!slide) return false;

      await db.query(`
        UPDATE slider SET is_active = ? WHERE id = ?
      `, [slide.active ? 0 : 1, id]);

      return true;
    } catch (error) {
      console.error('Error toggling slide active:', error);
      return false;
    }
  }

  public getImageUrl(filename: string): string {
    return `/images/slide/${filename}`;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}

export const sliderService = SliderService.getInstance();
