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
  { id: 'products', text: 'Products', icon: 'fa fa-box-open', url: '/admin/products', adminOnly: false },
  { id: 'categories', text: 'Categories', icon: 'fa fa-th-large', url: '/admin/categories', adminOnly: false },
  { id: 'brands', text: 'Brands', icon: 'fa fa-tags', url: '/admin/brands', adminOnly: false },
  { id: 'pages', text: 'Pages', icon: 'fa fa-file-alt', url: '/admin/pages', adminOnly: false },
  { id: 'menus', text: 'Menus', icon: 'fa fa-bars', url: '/admin/menus', adminOnly: false },
  { id: 'offices', text: 'Offices', icon: 'fa fa-map-marker-alt', url: '/admin/offices', adminOnly: false },
  { id: 'inquiries', text: 'Inquiries', icon: 'fa fa-envelope', url: '/admin/inquiries', adminOnly: false },
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
