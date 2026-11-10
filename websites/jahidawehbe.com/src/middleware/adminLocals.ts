import { thumbUrl } from '../domain/media.js';
import { settingsService } from '../services/settingsService.js';
import { videoService } from '../services/videoService.js';
import { asyncHandler } from './asyncHandler.js';

interface AdminMenuEntry {
  id: string;
  text: string;
  icon: string;
  url: string;
  adminOnly: boolean;
}

const ADMIN_MENU: AdminMenuEntry[] = [
  { id: 'dashboard', text: 'Dashboard', icon: 'fa fa-laptop', url: '/admin/dashboard', adminOnly: false },
  { id: 'home', text: 'Home Page', icon: 'fa fa-home', url: '/admin/home', adminOnly: false },
  { id: 'videos', text: 'Videos', icon: 'fab fa-youtube', url: '/admin/videos', adminOnly: false },
  { id: 'events', text: 'Events', icon: 'fa fa-calendar-alt', url: '/admin/events', adminOnly: false },
  { id: 'news', text: 'News', icon: 'fa fa-newspaper', url: '/admin/news', adminOnly: false },
  { id: 'pages', text: 'Pages', icon: 'fa fa-file-alt', url: '/admin/pages', adminOnly: false },
  { id: 'social', text: 'Social Media', icon: 'fa fa-share-alt', url: '/admin/social', adminOnly: false },
  { id: 'menus', text: 'Menus', icon: 'fa fa-bars', url: '/admin/menus', adminOnly: false },
  { id: 'users', text: 'Users', icon: 'fa fa-users', url: '/admin/users', adminOnly: true },
  { id: 'site-settings', text: 'Site Settings', icon: 'fa fa-cog', url: '/admin/site-settings', adminOnly: true }
];

export const adminLocals = asyncHandler(async (req, res, next) => {
  const settings = await settingsService.get();
  res.locals.siteTitle = settings.siteName;
  res.locals.settings = settings;
  res.locals.thumbUrl = thumbUrl;
  res.locals.flash = req.session.flash ?? null;
  delete req.session.flash;
  if (req.currentUser) {
    const videoStatus = await videoService.status();
    const path = req.originalUrl.split('?')[0] ?? '';
    res.locals.adminMenu = ADMIN_MENU.filter((entry) => !entry.adminOnly || req.currentUser?.role === 'admin').map((entry) => ({
      ...entry,
      badge: entry.id === 'videos' && !videoStatus.healthy ? '!' : null,
      active: path === entry.url || path.startsWith(`${entry.url}/`)
    }));
  } else {
    res.locals.adminMenu = [];
  }
  next();
});
