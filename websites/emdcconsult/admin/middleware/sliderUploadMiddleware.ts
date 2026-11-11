import * as fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { StorageService } from '../services/storageService';
import {
  getSliderUploadMaxBytes,
  processUploadedSliderImage,
  respondSliderUploadError
} from '../services/sliderImageService';

const sliderMulter = StorageService.getInstance().createSliderUploadConfig();

/**
 * Parses multipart upload, then resizes/compresses slider images (see sliderImageService).
 */
export function sliderUploadAndOptimize(req: Request, res: Response, next: NextFunction): void {
  sliderMulter.single('image')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(getSliderUploadMaxBytes() / (1024 * 1024));
          respondSliderUploadError(
            req,
            res,
            `Image is too large. Maximum upload size is ${maxMb} MB (configure SLIDER_UPLOAD_MAX_BYTES).`
          );
          return;
        }
      }
      const msg = err instanceof Error ? err.message : 'File upload failed';
      respondSliderUploadError(req, res, msg);
      return;
    }

    const file = req.file;
    if (!file) {
      next();
      return;
    }

    void (async () => {
      try {
        await processUploadedSliderImage(file);
        next();
      } catch (e) {
        console.error('Slider image optimization failed:', e);
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {
          /* ignore */
        }
        respondSliderUploadError(
          req,
          res,
          'Could not process this image. Use a normal photo format (JPEG, PNG, WebP, etc.).'
        );
      }
    })();
  });
}
