import { thumbUrl } from '../domain/media.js';
import { contactService } from '../services/contactService.js';
import { settingsService } from '../services/settingsService.js';
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
  { id: 'articles', text: 'Articles', icon: 'fa fa-newspaper', url: '/admin/articles', adminOnly: false },
  { id: 'sections', text: 'Sections', icon: 'fa fa-layer-group', url: '/admin/sections', adminOnly: false },
  { id: 'pages', text: 'Pages', icon: 'fa fa-file-alt', url: '/admin/pages', adminOnly: false },
  { id: 'books', text: 'Library', icon: 'fa fa-book', url: '/admin/books', adminOnly: false },
  { id: 'hymns', text: 'Hymns', icon: 'fa fa-music', url: '/admin/hymns', adminOnly: false },
  { id: 'albums', text: 'Photo Albums', icon: 'fa fa-images', url: '/admin/albums', adminOnly: false },
  { id: 'videos', text: 'Videos', icon: 'fa fa-video', url: '/admin/videos', adminOnly: false },
  { id: 'purchases', text: 'Purchases', icon: 'fa fa-shopping-bag', url: '/admin/purchases', adminOnly: false },
  { id: 'menus', text: 'Menus', icon: 'fa fa-bars', url: '/admin/menus', adminOnly: false },
  { id: 'inquiries', text: 'Inquiries', icon: 'fa fa-envelope', url: '/admin/inquiries', adminOnly: false },
  { id: 'newsletter', text: 'Newsletter', icon: 'fa fa-paper-plane', url: '/admin/newsletter', adminOnly: false },
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
    const unread = await contactService.countUnread();
    const path = req.originalUrl.split('?')[0] ?? '';
    res.locals.adminMenu = ADMIN_MENU.filter((entry) => !entry.adminOnly || req.currentUser?.role === 'admin').map((entry) => ({
      ...entry,
      badge: entry.id === 'inquiries' && unread > 0 ? unread : null,
      active: path === entry.url || path.startsWith(`${entry.url}/`)
    }));
  } else {
    res.locals.adminMenu = [];
  }
  next();
});
