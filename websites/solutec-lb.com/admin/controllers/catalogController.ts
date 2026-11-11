import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { CatalogAdminService } from '../services/catalogAdminService';
import { ProductRecord } from '../../src/services/productsService';

const catalogDir = path.resolve(process.cwd(), 'public', 'uploads', 'catalog');
const catalogUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(catalogDir, { recursive: true });
      cb(null, catalogDir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

function publicUpload(file?: Express.Multer.File): string {
  return file ? `/uploads/catalog/${file.filename}` : '';
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value) return [String(value)];
  return [];
}

const catalog = CatalogAdminService.getInstance();

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export class CatalogController {
  public static products(req: Request, res: Response): void {
    res.render('products/products', {
      title: 'Products',
      pageTitle: 'Products',
      products: catalog.getProducts(),
      success: req.query['success'],
      error: req.query['error']
    });
  }

  public static editProduct(req: Request, res: Response): void {
    const key = String(req.params['key'] || '');
    const creating = key === 'new';
    const product = creating ? null : catalog.getProduct(key);
    if (!creating && !product) {
      res.redirect('/admin/products?error=Product not found');
      return;
    }
    res.render('products/edit-product', {
      title: creating ? 'New product' : 'Edit product',
      pageTitle: creating ? 'New product' : 'Edit product',
      product,
      categories: catalog.getCategories(),
      isCreate: creating,
      includeCustomEditor: true
    });
  }

  public static saveProduct(req: Request, res: Response): void {
    catalogUpload.fields([
      { name: 'imageFile', maxCount: 1 },
      { name: 'galleryFiles', maxCount: 12 }
    ])(req, res, (err) => {
      if (err) {
        res.redirect(`/admin/products?error=${encodeURIComponent(err.message)}`);
        return;
      }
      const body = req.body || {};
      const key = slugify(String(body.key || body.title || ''));
      if (!key || !String(body.title || '').trim()) {
        res.redirect('/admin/products?error=Title is required');
        return;
      }
      const categories = asList(body.categories);
      const existing = catalog.getProduct(key);
      const files = req.files as { [name: string]: Express.Multer.File[] } | undefined;
      const uploadedImage = publicUpload(files?.imageFile?.[0]);
      const removed = new Set(asList(body.removeGallery));
      const gallery = (existing?.gallery || []).filter((image) => !removed.has(image));
      (files?.galleryFiles || []).forEach((file) => gallery.push(publicUpload(file)));
      const image = body.removeImage === '1' && !uploadedImage ? '' : (uploadedImage || existing?.image || '');
      const title = String(body.title).trim();
      const seoTitle = String(body.seoTitle || title);
      const product: ProductRecord = {
        key,
        title,
        url: `/product/${key}`,
        sku: String(body.sku || ''),
        price: String(body.price || ''),
        excerpt: String(body.excerpt || ''),
        content: String(body.content || ''),
        image,
        gallery,
        categories,
        status: body.status === 'draft' ? 'draft' : 'published',
        seo: {
          pageTitle: seoTitle.includes('Solutec') ? seoTitle : `${title} – Solutec`,
          pageDescription: String(body.seoDescription || ''),
          pageKeywords: categories.join(', '),
          pageImage: image,
          pageType: 'product'
        }
      };
      catalog.saveProduct(product);
      res.redirect('/admin/products?success=Saved');
    });
  }

  public static deleteProduct(req: Request, res: Response): void {
    catalog.deleteProduct(String(req.params['key'] || ''));
    res.redirect('/admin/products?success=Deleted');
  }

  public static categories(req: Request, res: Response): void {
    const categories = catalog.getCategories();
    const productsByCategory: Record<string, string[]> = {};
    categories.forEach((category) => {
      productsByCategory[category.slug] = catalog.getProductsInCategory(category.slug).map((product) => product.title);
    });
    res.render('products/categories', {
      title: 'Product categories',
      pageTitle: 'Product categories',
      categories,
      productsByCategory,
      success: req.query['success'],
      error: req.query['error']
    });
  }

  public static editCategory(req: Request, res: Response): void {
    const slug = String(req.params['slug'] || '');
    const creating = slug === 'new';
    const category = creating ? null : catalog.getCategory(slug);
    if (!creating && !category) {
      res.redirect('/admin/product-categories?error=Category not found');
      return;
    }
    res.render('products/edit-category', {
      title: creating ? 'New category' : 'Edit category',
      pageTitle: creating ? 'New category' : 'Edit category',
      category,
      isCreate: creating
    });
  }

  public static saveCategory(req: Request, res: Response): void {
    catalogUpload.single('imageFile')(req, res, (err) => {
      if (err) {
        res.redirect(`/admin/product-categories?error=${encodeURIComponent(err.message)}`);
        return;
      }
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const slug = slugify(String(body.slug || name));
      if (!name || !slug) {
        res.redirect('/admin/product-categories?error=Name is required');
        return;
      }
      const existing = catalog.getCategory(slug);
      const uploaded = publicUpload(req.file);
      const image = body.removeImage === '1' && !uploaded ? '' : (uploaded || existing?.image || '');
      catalog.saveCategory({
        key: slug,
        name,
        slug,
        description: String(body.description || ''),
        image,
        sort: Number(body.sort || 0),
        showOnHome: body.showOnHome === '1',
        status: body.status === 'hidden' ? 'hidden' : 'active'
      });
      res.redirect('/admin/product-categories?success=Saved');
    });
  }

  public static deleteCategory(req: Request, res: Response): void {
    if (!catalog.deleteCategory(String(req.params['slug'] || ''))) {
      res.redirect(`/admin/product-categories?error=${encodeURIComponent('Category has products and cannot be deleted. Move the products or hide the category instead.')}`);
      return;
    }
    res.redirect('/admin/product-categories?success=Deleted');
  }

  public static setCategoryStatus(req: Request, res: Response): void {
    const status = req.body?.status === 'hidden' ? 'hidden' : 'active';
    if (!catalog.setCategoryStatus(String(req.params['slug'] || ''), status)) {
      res.redirect('/admin/product-categories?error=Category not found');
      return;
    }
    res.redirect(`/admin/product-categories?success=${status === 'hidden' ? 'Category hidden' : 'Category visible'}`);
  }
}
