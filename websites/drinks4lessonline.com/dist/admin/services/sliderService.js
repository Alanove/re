"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sliderService = exports.SliderService = void 0;
const database_1 = require("../../src/config/database");
function isUnknownColumnError(err, column) {
    const e = err;
    const msg = String(e?.message || '');
    if (e?.errno !== 1054 && !/Unknown column/i.test(msg))
        return false;
    return new RegExp(column, 'i').test(msg);
}
function isUnknownDurationColumnError(err) {
    return isUnknownColumnError(err, 'duration_seconds');
}
function isUnknownMobileColumnError(err) {
    return isUnknownColumnError(err, 'mobile_image_url') || isUnknownColumnError(err, 'mobile_video_url');
}
function isUnknownMediaColumnError(err) {
    return (isUnknownColumnError(err, 'media_type') ||
        isUnknownColumnError(err, 'video_url') ||
        isUnknownColumnError(err, 'poster_image'));
}
class SliderService {
    constructor() { }
    static getInstance() {
        if (!SliderService.instance) {
            SliderService.instance = new SliderService();
        }
        return SliderService.instance;
    }
    reloadData() {
    }
    withDefaultDuration(rows) {
        return rows.map((r) => {
            const d = r.durationSeconds;
            return {
                ...r,
                durationSeconds: d != null && d > 0 ? d : 5
            };
        });
    }
    async querySlides(whereOrderSql, params) {
        const fromSql = `
        FROM slider
        ${whereOrderSql}`;
        const attempts = [
            SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_MEDIA + SliderService.SLIDER_SELECT_DURATION + SliderService.SLIDER_SELECT_MOBILE + fromSql,
            SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_DURATION + SliderService.SLIDER_SELECT_MOBILE + fromSql,
            SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_DURATION + fromSql,
            SliderService.SLIDER_SELECT_CORE + SliderService.SLIDER_SELECT_MOBILE + fromSql,
            SliderService.SLIDER_SELECT_CORE + fromSql
        ];
        let lastError;
        for (const sql of attempts) {
            try {
                const [rows] = await database_1.db.query(sql, params);
                return this.withDefaultDuration(rows);
            }
            catch (err) {
                lastError = err;
                if (!isUnknownDurationColumnError(err) &&
                    !isUnknownMobileColumnError(err) &&
                    !isUnknownMediaColumnError(err)) {
                    throw err;
                }
            }
        }
        throw lastError;
    }
    async getAllSlides() {
        try {
            return await this.querySlides('ORDER BY order_index ASC, id ASC', []);
        }
        catch (error) {
            console.error('Error fetching slides:', error);
            return [];
        }
    }
    async getActiveSlides() {
        try {
            return await this.querySlides('WHERE is_active = 1 ORDER BY order_index ASC, id ASC', []);
        }
        catch (error) {
            console.error('Error fetching active slides:', error);
            return [];
        }
    }
    async writeSequentialOrders(idsInOrder) {
        for (let i = 0; i < idsInOrder.length; i++) {
            await database_1.db.query('UPDATE slider SET order_index = ? WHERE id = ?', [i + 1, idsInOrder[i]]);
        }
    }
    async listSlideIdsInOrder() {
        const slides = await this.querySlides('ORDER BY order_index ASC, id ASC', []);
        return slides.map((slide) => slide.id);
    }
    async getSlideById(id) {
        try {
            const rows = await this.querySlides('WHERE id = ?', [id]);
            return rows[0] || null;
        }
        catch (error) {
            console.error('Error fetching slide by ID:', error);
            return null;
        }
    }
    async addSlide(image, alt, order, title, link, buttonText, mediaType, videoUrl, posterImage, durationSeconds = 5, mobileImage, mobileVideo) {
        try {
            const placeFirst = order === undefined || order === null || Number.isNaN(order);
            let orderIndex;
            if (placeFirst) {
                orderIndex = -1000000;
            }
            else {
                await database_1.db.query('UPDATE slider SET order_index = order_index + 1 WHERE order_index >= ?', [order]);
                orderIndex = order;
            }
            const baseCols = 'image_url, title, subtitle, order_index, link_url, link_text, is_active, media_type, video_url, poster_image';
            const baseVals = [image, title || '', alt, orderIndex, link || '', buttonText || '', mediaType || 'image', videoUrl || null, posterImage || null];
            const insertAttempts = [
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
            let result = null;
            let inserted = false;
            let lastInsertError = new Error('Failed to insert slide');
            for (const attempt of insertAttempts) {
                try {
                    [result] = await database_1.db.query(attempt.sql, attempt.vals);
                    inserted = true;
                    break;
                }
                catch (insertErr) {
                    lastInsertError = insertErr;
                    if (!isUnknownDurationColumnError(insertErr) && !isUnknownMobileColumnError(insertErr))
                        throw insertErr;
                }
            }
            if (!inserted)
                throw lastInsertError;
            const insertId = result.insertId;
            if (placeFirst) {
                const ids = await this.listSlideIdsInOrder();
                await this.writeSequentialOrders(ids);
            }
            const slide = await this.getSlideById(insertId.toString());
            if (!slide)
                throw new Error('Failed to retrieve created slide');
            return slide;
        }
        catch (error) {
            console.error('Error adding slide:', error);
            throw new Error('Failed to add slide');
        }
    }
    async updateSlide(id, updates) {
        try {
            const updateFields = [];
            const values = [];
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
                await database_1.db.query(`
        UPDATE slider
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
            }
            catch (updateErr) {
                const dropDuration = isUnknownDurationColumnError(updateErr) && updates.durationSeconds !== undefined;
                const dropMobile = isUnknownMobileColumnError(updateErr) && (updates.mobileImage !== undefined || updates.mobileVideo !== undefined);
                if (dropDuration || dropMobile) {
                    const rest = { ...updates };
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
        }
        catch (error) {
            console.error('Error updating slide:', error);
            return null;
        }
    }
    async deleteSlide(id) {
        try {
            const [result] = await database_1.db.query(`
        DELETE FROM slider WHERE id = ?
      `, [id]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting slide:', error);
            return false;
        }
    }
    async moveSlide(id, direction) {
        const ids = await this.listSlideIdsInOrder();
        const currentIndex = ids.findIndex((slideId) => String(slideId) === String(id));
        if (currentIndex < 0)
            return false;
        const targetIndex = currentIndex + direction;
        if (targetIndex < 0 || targetIndex >= ids.length)
            return false;
        const moved = ids[currentIndex];
        ids.splice(currentIndex, 1);
        ids.splice(targetIndex, 0, moved);
        await this.writeSequentialOrders(ids);
        return true;
    }
    async moveSlideUp(id) {
        try {
            return await this.moveSlide(id, -1);
        }
        catch (error) {
            console.error('Error moving slide up:', error);
            return false;
        }
    }
    async moveSlideDown(id) {
        try {
            return await this.moveSlide(id, 1);
        }
        catch (error) {
            console.error('Error moving slide down:', error);
            return false;
        }
    }
    async toggleSlideActive(id) {
        try {
            const slide = await this.getSlideById(id);
            if (!slide)
                return false;
            await database_1.db.query(`
        UPDATE slider SET is_active = ? WHERE id = ?
      `, [slide.active ? 0 : 1, id]);
            return true;
        }
        catch (error) {
            console.error('Error toggling slide active:', error);
            return false;
        }
    }
    getImageUrl(filename) {
        return `/images/${filename}`;
    }
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
}
exports.SliderService = SliderService;
SliderService.SLIDER_SELECT_CORE = `
        SELECT 
          CAST(id AS CHAR) as id,
          image_url as image,
          subtitle as alt,
          order_index as \`order\`,
          is_active as active,
          title,
          link_url as link,
          link_text as buttonText`;
SliderService.SLIDER_SELECT_MEDIA = `,
          media_type as mediaType,
          video_url as videoUrl,
          poster_image as posterImage`;
SliderService.SLIDER_SELECT_DURATION = `,
          duration_seconds as durationSeconds`;
SliderService.SLIDER_SELECT_MOBILE = `,
          mobile_image_url as mobileImage,
          mobile_video_url as mobileVideo`;
exports.sliderService = SliderService.getInstance();
//# sourceMappingURL=sliderService.js.map