import { db } from '../../src/config/database';

/** When `duration_seconds` is not migrated yet, MySQL returns errno 1054; queries must fall back. */
function isUnknownDurationColumnError(err: unknown): boolean {
  const e = err as { errno?: number; code?: string; message?: string };
  if (e?.errno === 1054) return true;
  const msg = String(e?.message || '');
  return /duration_seconds/i.test(msg) && /Unknown column/i.test(msg);
}

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
  /** Seconds each slide is shown on the home carousel (default 5) */
  durationSeconds?: number;
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

  private static readonly SLIDER_SELECT_CORE = `
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
          poster_image as posterImage`;

  private withDefaultDuration(rows: any[]): Slide[] {
    return (rows as any[]).map((r) => {
      const d = r.durationSeconds;
      return {
        ...r,
        durationSeconds: d != null && d > 0 ? d : 5
      } as Slide;
    });
  }

  /**
   * Reads slides; if `duration_seconds` column is missing (migration not run), falls back and defaults duration to 5.
   */
  private async querySlides(whereOrderSql: string, params: any[]): Promise<Slide[]> {
    const withDuration = `${SliderService.SLIDER_SELECT_CORE}
          , duration_seconds as durationSeconds
        FROM slider
        ${whereOrderSql}`;
    const noDuration = `${SliderService.SLIDER_SELECT_CORE}
        FROM slider
        ${whereOrderSql}`;

    try {
      const [rows] = await db.query(withDuration, params);
      return this.withDefaultDuration(rows as any[]);
    } catch (err) {
      if (isUnknownDurationColumnError(err)) {
        const [rows] = await db.query(noDuration, params);
        return this.withDefaultDuration(rows as any[]);
      }
      throw err;
    }
  }

  public async getAllSlides(): Promise<Slide[]> {
    try {
      return await this.querySlides('ORDER BY order_index ASC, id ASC', []);
    } catch (error) {
      console.error('Error fetching slides:', error);
      return [];
    }
  }

  public async getActiveSlides(): Promise<Slide[]> {
    try {
      return await this.querySlides('WHERE is_active = 1 ORDER BY order_index ASC, id ASC', []);
    } catch (error) {
      console.error('Error fetching active slides:', error);
      return [];
    }
  }

  /** Rewrite order_index to 1..n so every slide has a unique position. */
  private async writeSequentialOrders(idsInOrder: string[]): Promise<void> {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE slider SET order_index = ? WHERE id = ?', [i + 1, idsInOrder[i]]);
    }
  }

  private async listSlideIdsInOrder(): Promise<string[]> {
    const slides = await this.querySlides('ORDER BY order_index ASC, id ASC', []);
    return slides.map((slide) => slide.id);
  }

  public async getSlideById(id: string): Promise<Slide | null> {
    try {
      const rows = await this.querySlides('WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching slide by ID:', error);
      return null;
    }
  }

  public async addSlide(image: string, alt: string, order?: number, title?: string, link?: string, buttonText?: string, mediaType?: 'image' | 'video', videoUrl?: string, posterImage?: string, durationSeconds: number = 5): Promise<Slide> {
    try {
      // Missing order means "put this slide first". A real number is kept and made unique.
      const placeFirst = order === undefined || order === null || Number.isNaN(order);
      let orderIndex: number;
      if (placeFirst) {
        orderIndex = -1000000;
      } else {
        await db.query(
          'UPDATE slider SET order_index = order_index + 1 WHERE order_index >= ?',
          [order]
        );
        orderIndex = order as number;
      }

      let result: any;
      try {
        [result] = await db.query(`
        INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `, [image, title || '', alt, orderIndex, link || '', buttonText || '', mediaType || 'image', videoUrl || null, posterImage || null, durationSeconds]);
      } catch (insertErr) {
        if (!isUnknownDurationColumnError(insertErr)) throw insertErr;
        [result] = await db.query(`
        INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `, [image, title || '', alt, orderIndex, link || '', buttonText || '', mediaType || 'image', videoUrl || null, posterImage || null]);
      }

      const insertId = (result as any).insertId;
      if (placeFirst) {
        const ids = await this.listSlideIdsInOrder();
        await this.writeSequentialOrders(ids);
      }
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
      if (updates.durationSeconds !== undefined) {
        updateFields.push('duration_seconds = ?');
        values.push(updates.durationSeconds);
      }

      if (updateFields.length === 0) {
        return await this.getSlideById(id);
      }

      values.push(id);
      try {
        await db.query(`
        UPDATE slider
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
      } catch (updateErr) {
        if (isUnknownDurationColumnError(updateErr) && updates.durationSeconds !== undefined) {
          console.warn(
            '[slider] UPDATE skipped duration_seconds: column missing. Run migration 2026-04-26-add-slider-duration-seconds.ts'
          );
          const { durationSeconds: _omit, ...rest } = updates;
          return this.updateSlide(id, rest);
        }
        throw updateErr;
      }
      
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

  private async moveSlide(id: string, direction: -1 | 1): Promise<boolean> {
    const ids = await this.listSlideIdsInOrder();
    const currentIndex = ids.findIndex((slideId) => String(slideId) === String(id));
    if (currentIndex < 0) return false;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= ids.length) return false;

    const moved = ids[currentIndex];
    ids.splice(currentIndex, 1);
    ids.splice(targetIndex, 0, moved);
    await this.writeSequentialOrders(ids);
    return true;
  }

  public async moveSlideUp(id: string): Promise<boolean> {
    try {
      return await this.moveSlide(id, -1);
    } catch (error) {
      console.error('Error moving slide up:', error);
      return false;
    }
  }

  public async moveSlideDown(id: string): Promise<boolean> {
    try {
      return await this.moveSlide(id, 1);
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
    return `/images/${filename}`;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}

export const sliderService = SliderService.getInstance();
