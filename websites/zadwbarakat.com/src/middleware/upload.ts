import type { Request } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors/httpError.js';
import { MAX_AUDIO_BYTES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, type IncomingFile } from '../services/mediaService.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 30, fields: 3000, fieldSize: 1024 * 1024, parts: 3100 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`${file.originalname} is not a JPEG, PNG, GIF or WebP image.`));
    }
  }
});

const isVideoField = (fieldName: string): boolean => /video/i.test(fieldName);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 40, fields: 3000, fieldSize: 1024 * 1024, parts: 3100 },
  fileFilter: (_req, file, callback) => {
    if (isVideoField(file.fieldname)) {
      if (VIDEO_MIME.has(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new BadRequestError(`${file.originalname} is not an MP4 or WebM video.`));
      }
      return;
    }
    if (ALLOWED_MIME.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`${file.originalname} is not a JPEG, PNG, GIF or WebP image.`));
    }
  }
});

const DOCUMENT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream'
]);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 10, fieldSize: 10 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (DOCUMENT_MIME.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`${file.originalname} is not a supported PDF, Word, Excel or PowerPoint file.`));
    }
  }
});

const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp3']);

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 40, fieldSize: 64 * 1024, parts: 50 },
  fileFilter: (_req, file, callback) => {
    if (AUDIO_MIME.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`${file.originalname} is not an MP3 file.`));
    }
  }
});

/** Browsers report .csv files under several types (Excel on Windows sends application/vnd.ms-excel). */
const CSV_MIME = new Set(['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream']);
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 5, fieldSize: 1024, parts: 10 },
  fileFilter: (_req, file, callback) => {
    if (CSV_MIME.has(file.mimetype) && /\.csv$/i.test(file.originalname)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`${file.originalname} is not a CSV file.`));
    }
  }
});

const BRANDING_IMAGE_FIELDS = new Set(['logoFile', 'emblemFile', 'faviconFile', 'seoImageFile']);

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 4, fields: 80, fieldSize: 1024 * 1024, parts: 90 },
  fileFilter: (_req, file, callback) => {
    if (BRANDING_IMAGE_FIELDS.has(file.fieldname) && ALLOWED_MIME.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new BadRequestError(`${file.originalname} is not an allowed file for this field.`));
  }
});

export const uploadFields = (fields: { name: string; maxCount: number }[]) => imageUpload.fields(fields);
export const uploadMediaFields = (fields: { name: string; maxCount: number }[]) => mediaUpload.fields(fields);
export const uploadDocument = (name: string) => documentUpload.fields([{ name, maxCount: 1 }]);
export const uploadAudio = (name: string) => audioUpload.fields([{ name, maxCount: 1 }]);
export const uploadCsv = (name: string) => csvUpload.fields([{ name, maxCount: 1 }]);
export const uploadBranding = brandingUpload.fields([
  { name: 'logoFile', maxCount: 1 },
  { name: 'emblemFile', maxCount: 1 },
  { name: 'faviconFile', maxCount: 1 },
  { name: 'seoImageFile', maxCount: 1 }
]);

export function filesFor(req: Request, field: string): IncomingFile[] {
  const files = req.files;
  if (!files || Array.isArray(files)) {
    return [];
  }
  return (files[field] ?? []).filter((file) => file.size > 0);
}

export function firstFile(req: Request, field: string): IncomingFile | null {
  return filesFor(req, field)[0] ?? null;
}
