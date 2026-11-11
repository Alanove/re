import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { TeamService, COMPANY_KEYS } from '../services/teamService';
import { AdminMenuService } from '../services/adminMenuService';
import { SiteSettingsService } from '../services/siteSettingsService';
import { DATA_PATHS } from '../../src/constants';

const teamService = TeamService.getInstance();
const menuService = AdminMenuService.getInstance();
const siteSettingsService = SiteSettingsService.getInstance();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(DATA_PATHS.IMAGES_DIR, 'team');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

function parseCompanies(body: any) {
  return COMPANY_KEYS.filter((company) => body[`company_${company.key}`])
    .map((company) => ({
      key: company.key,
      sort: parseInt(body[`company_sort_${company.key}`], 10) || 1000,
      description: (body[`company_description_${company.key}`] || '').trim()
    }));
}

export class TeamController {
  public static async list(req: Request, res: Response): Promise<void> {
    menuService.setActiveMenuItem('/admin/team');
    res.render('team/team', {
      title: 'Our Team',
      pageTitle: 'Our Team',
      pageSubtitle: 'Manage employees and company assignments',
      items: teamService.getAll(),
      companies: COMPANY_KEYS,
      siteTitle: siteSettingsService.getSiteTitle(),
      success: req.query['success'],
      error: req.query['error']
    });
  }

  public static async create(_req: Request, res: Response): Promise<void> {
    menuService.setActiveMenuItem('/admin/team');
    res.render('team/edit-member', {
      title: 'Add Team Member',
      pageTitle: 'Add Team Member',
      pageSubtitle: 'Add an employee',
      item: teamService.getEmpty(),
      companies: COMPANY_KEYS,
      isCreateMode: true,
      siteTitle: siteSettingsService.getSiteTitle()
    });
  }

  public static async createPost(req: Request, res: Response): Promise<void> {
    upload.single('photoFile')(req, res, (err) => {
      if (err) {
        res.redirect('/admin/team?error=' + encodeURIComponent(err.message));
        return;
      }
      try {
        const photo = req.file ? `/images/team/${req.file.filename}` : '';
        teamService.create({
          name: (req.body.name || '').trim(),
          description: (req.body.description || '').trim(),
          bio: (req.body.bio || '').trim(),
          photo,
          companies: parseCompanies(req.body),
          status: req.body.isActive ? 'published' : 'draft'
        });
        res.redirect('/admin/team?success=Team member added');
      } catch (error: any) {
        res.redirect('/admin/team?error=' + encodeURIComponent(error.message || 'Unable to save'));
      }
    });
  }

  public static async edit(req: Request, res: Response): Promise<void> {
    const item = teamService.getById(String(req.params['id'] || ''));
    if (!item) {
      res.redirect('/admin/team?error=Team member not found');
      return;
    }
    menuService.setActiveMenuItem('/admin/team');
    res.render('team/edit-member', {
      title: 'Edit Team Member',
      pageTitle: 'Edit Team Member',
      pageSubtitle: 'Update employee details',
      item,
      companies: COMPANY_KEYS,
      isCreateMode: false,
      siteTitle: siteSettingsService.getSiteTitle()
    });
  }

  public static async editPost(req: Request, res: Response): Promise<void> {
    upload.single('photoFile')(req, res, (err) => {
      if (err) {
        res.redirect('/admin/team?error=' + encodeURIComponent(err.message));
        return;
      }
      const existing = teamService.getById(String(req.params['id'] || ''));
      if (!existing) {
        res.redirect('/admin/team?error=Team member not found');
        return;
      }
      const photo = req.file ? `/images/team/${req.file.filename}` : (existing.photo || '');
      teamService.update(String(req.params['id'] || ''), {
        name: (req.body.name || '').trim(),
        description: (req.body.description || '').trim(),
        bio: (req.body.bio || '').trim(),
        photo,
        companies: parseCompanies(req.body),
        status: req.body.isActive ? 'published' : 'draft'
      });
      res.redirect('/admin/team?success=Team member updated');
    });
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    teamService.delete(String(req.params['id'] || ''));
    res.json({ success: true });
  }
}
