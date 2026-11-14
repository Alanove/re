import { db } from '../../src/config/database';

/** When a column is not migrated yet, MySQL returns errno 1054; queries must fall back. */
function isUnknownColumnError(err: unknown, column: string): boolean {
  const e = err as { errno?: number; message?: string };
  const msg = String(e?.message || '');
  if (e?.errno !== 1054 && !/Unknown column/i.test(msg)) return false;
  return new RegExp(column, 'i').test(msg);
}

function isUnknownDurationColumnError(err: unknown): boolean {
  return isUnknownColumnError(err, 'duration_seconds');
}

function isUnknownMobileColumnError(err: unknown): boolean {
  return isUnknownColumnError(err, 'mobile_image_url') || isUnknownColumnError(err, 'mobile_video_url');
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
  /** Optional phone image. Empty means the desktop image is used below 768px. */
  mobileImage?: string | null;
  /** Optional phone video. Empty means the desktop video or image is used below 768px. */
  mobileVideo?: string | null;
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

  private static readonly SLIDER_SELECT_DURATION = `,
          duration_seconds as durationSeconds`;

  private static readonly SLIDER_SELECT_MOBILE = `,
          mobile_image_url as mobileImage,
          mobile_video_url as mobileVideo`;

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
    const fromSql = `
        FROM slider
        ${whereOrderSql}`;
    const attempts = [
      SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_DURATION + SliderService.SLIDER_SELECT_MOBILE + fromSql,
      SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_DURATION + fromSql,
      SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_MOBILE + fromSql,
      SliderService.SLIDER_SELECT_CORE + fromSql
    ];

    let lastError: unknown;
    for (const sql of attempts) {
      try {
        const [rows] = await db.query(sql, params);
        return this.withDefaultDuration(rows as any[]);
      } catch (err) {
        lastError = err;
        if (!isUnknownDurationColumnError(err) && !isUnknownMobileColumnError(err)) {
          throw err;
        }
      }
    }
    throw lastError;
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

  public async addSlide(image: string, alt: string, order?: number, title?: string, link?: string, buttonText?: string, mediaType?: 'image' | 'video', videoUrl?: string, posterImage?: string, durationSeconds: number = 5, mobileImage?: string | null, mobileVideo?: string | null): Promise<Slide> {
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

      const baseCols = 'image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image';
      const baseVals = [image, title || '', alt, orderIndex, link || '', buttonText || '', mediaType || 'image', videoUrl || null, posterImage || null];

      const insertAttempts: Array<{ sql: string; vals: any[] }> = [
        {
          sql: `INSERT INTO slider (${baseCols}, duration_seconds, mobile_image_url, mobile_video_url) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
          vals: [...baseVals, durationSeconds, mobileImage || null, mobileVideo || null]
        },
        {
          sql: `INSERT INTO slider (${baseCols}, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          vals: [...baseVals, durationSeconds]
        },
        {
          sql: `INSERT INTO slider (${baseCols}, mobile_image_url, mobile_video_url) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
          vals: [...baseVals, mobileImage || null, mobileVideo || null]
        },
        {
          sql: `INSERT INTO slider (${baseCols}) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          vals: baseVals
        }
      ];

      let result: any = null;
      let inserted = false;
      let lastInsertError: unknown = new Error('Failed to insert slide');
      for (const attempt of insertAttempts) {
        try {
          [result] = await db.query(attempt.sql, attempt.vals);
          inserted = true;
          break;
        } catch (insertErr) {
          lastInsertError = insertErr;
          if (!isUnknownDurationColumnError(insertErr) && !isUnknownMobileColumnError(insertErr)) throw insertErr;
        }
      }
      if (!inserted) throw lastInsertError;

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
      if (updates.mobileImage !== undefined) {
        updateFields.push('mobile_image_url = ?');
        values.push(updates.mobileImage || null);
      }
      if (updates.mobileVideo !== undefined) {
        updateFields.push('mobile_video_url = ?');
        values.push(updates.mobileVideo || null);
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
        const dropDuration = isUnknownDurationColumnError(updateErr) && updates.durationSeconds !== undefined;
        const dropMobile = isUnknownMobileColumnError(updateErr) && (updates.mobileImage !== undefined || updates.mobileVideo !== undefined);
        if (dropDuration || dropMobile) {
          const rest: Partial<Omit<Slide, 'id'>> = { ...updates };
          if (dropDuration) {
            console.warn('[slider] UPDATE skipped duration_seconds: column missing.');
            delete rest.durationSeconds;
          }
          if (dropMobile) {
            console.warn('[slider] UPDATE skipped mobile media columns: run migration 2026-10-15-add-slider-mobile-media.ts');
            delete rest.mobileImage;
            delete rest.mobileVideo;
          }
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
