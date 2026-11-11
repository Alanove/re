import { db } from '../../src/config/database';

/** MySQL ER_BAD_FIELD_ERROR — try next query variant when optional columns are not migrated yet. */
function isMysqlUnknownColumnError(err: unknown): boolean {
  return (err as { errno?: number }).errno === 1054;
}

/** When `duration_seconds` is not migrated yet, UPDATE must omit that field. */
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
  /** Optional portrait-oriented video for narrow viewports (home hero) */
  videoUrlMobile?: string;
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

  private static readonly SLIDER_ROWS_BASE = `
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

  /** Sliders created before video columns existed (no media_type / video_url / poster_image). */
  private static readonly SLIDER_LEGACY_WITH_DURATION = `
        CAST(id AS CHAR) as id,
        image_url as image,
        subtitle as alt,
        order_index as \`order\`,
        is_active as active,
        title,
        link_url as link,
        link_text as buttonText,
        duration_seconds as durationSeconds`;

  private static readonly SLIDER_LEGACY_NO_DURATION = `
        CAST(id AS CHAR) as id,
        image_url as image,
        subtitle as alt,
        order_index as \`order\`,
        is_active as active,
        title,
        link_url as link,
        link_text as buttonText`;

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
   * Reads slides; falls back when optional columns are not migrated yet
   * (`media_type` / `video_url` / `poster_image`, `video_url_mobile`, `duration_seconds`).
   */
  private async querySlides(whereOrderSql: string, params: any[]): Promise<Slide[]> {
    const base = SliderService.SLIDER_ROWS_BASE;
    const sqlAttempts = [
      `SELECT ${base},
          video_url_mobile as videoUrlMobile,
          duration_seconds as durationSeconds
        FROM slider
        ${whereOrderSql}`,
      `SELECT ${base},
          duration_seconds as durationSeconds
        FROM slider
        ${whereOrderSql}`,
      `SELECT ${base},
          video_url_mobile as videoUrlMobile
        FROM slider
        ${whereOrderSql}`,
      `SELECT ${base}
        FROM slider
        ${whereOrderSql}`,
      `SELECT ${SliderService.SLIDER_LEGACY_WITH_DURATION}
        FROM slider
        ${whereOrderSql}`,
      `SELECT ${SliderService.SLIDER_LEGACY_NO_DURATION}
        FROM slider
        ${whereOrderSql}`
    ];

    let lastErr: unknown;
    for (const sql of sqlAttempts) {
      try {
        const [rows] = await db.query(sql, params);
        return this.withDefaultDuration(rows as any[]);
      } catch (err) {
        lastErr = err;
        if (!isMysqlUnknownColumnError(err)) throw err;
      }
    }
    throw lastErr;
  }

  public async getAllSlides(): Promise<Slide[]> {
    try {
      return await this.querySlides('ORDER BY order_index', []);
    } catch (error) {
      console.error('Error fetching slides:', error);
      return [];
    }
  }

  public async getActiveSlides(): Promise<Slide[]> {
    try {
      return await this.querySlides('WHERE is_active = 1 ORDER BY order_index', []);
    } catch (error) {
      console.error('Error fetching active slides:', error);
      return [];
    }
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

  public async addSlide(image: string, alt: string, order?: number, title?: string, link?: string, buttonText?: string, mediaType?: 'image' | 'video', videoUrl?: string, posterImage?: string, durationSeconds: number = 5, videoUrlMobile?: string): Promise<Slide> {
    try {
      const common = [image, title || '', alt, order || 0, link || '', buttonText || '', mediaType || 'image', videoUrl || null];
      const insertAttempts: Array<[string, unknown[]]> = [
        [
          `INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, video_url_mobile, poster_image, duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
          [...common, videoUrlMobile || null, posterImage || null, durationSeconds]
        ],
        [
          `INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image, duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [...common, posterImage || null, durationSeconds]
        ],
        [
          `INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, video_url_mobile, poster_image)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [...common, videoUrlMobile || null, posterImage || null]
        ],
        [
          `INSERT INTO slider (image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [...common, posterImage || null]
        ]
      ];

      let result: any;
      let lastErr: unknown;
      for (const [sql, vals] of insertAttempts) {
        try {
          [result] = await db.query(sql, vals);
          lastErr = undefined;
          break;
        } catch (insertErr) {
          lastErr = insertErr;
          if (!isMysqlUnknownColumnError(insertErr)) throw insertErr;
        }
      }
      if (lastErr) throw lastErr;

      const insertId = (result as any).insertId;
      const slide = await this.getSlideById(insertId.toString());
      if (!slide) throw new Error('Failed to retrieve created slide');
      return slide;
    } catch (error) {
      console.error('Error adding slide:', error);
      const sqlMsg = String((error as { message?: string }).message || error);
      if (/Unknown column.*(media_type|video_url|poster_image)/i.test(sqlMsg)) {
        throw new Error(
          'Database is missing slider video columns. Run `npm run migrate` to apply migration 2026-05-11-add-slider-media-type-video-poster.ts.'
        );
      }
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
      if (updates.videoUrlMobile !== undefined) {
        updateFields.push('video_url_mobile = ?');
        values.push(updates.videoUrlMobile);
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
    return `/images/${filename}`;
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}

export const sliderService = SliderService.getInstance();
