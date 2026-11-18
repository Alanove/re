import { redirectService } from '../services/redirectService.js';
import { asyncHandler } from './asyncHandler.js';

export const legacyRedirects = asyncHandler(async (req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/admin') || req.path.startsWith('/uploads/')) {
    next();
    return;
  }
  const target = await redirectService.resolve(req.path);
  if (!target) {
    next();
    return;
  }
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, `${target}${query}`);
});
