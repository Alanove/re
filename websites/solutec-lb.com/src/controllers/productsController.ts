import { Request, Response, NextFunction } from 'express';
import productsService from '../services/productsService';

export class ProductsController {
  public static category(req: Request, res: Response, next: NextFunction): void {
    const slug = String(req.params['slug'] || '');
    const category = productsService.getCategory(slug);
    if (!category) {
      next();
      return;
    }
    const products = productsService.getByCategory(slug);
    const perPage = 9;
    const shopPages = Math.max(1, Math.ceil(products.length / perPage));
    const requested = parseInt(String(req.params['page'] || '1'), 10) || 1;
    const shopPage = Math.min(Math.max(requested, 1), shopPages);
    (res.locals as any).pageTitle = `${category.name} – Solutec`;
    (res.locals as any).pageDescription = category.description || category.name;
    (res.locals as any).selected = 'products';
    (res.locals as any).bodyClass += ' woocommerce woocommerce-page';
    res.render('product-category', {
      catalogProducts: products.slice((shopPage - 1) * perPage, shopPage * perPage),
      categories: productsService.getCategoriesWithCounts(),
      shopPage,
      shopPages,
      shopBase: `/product-category/${slug}`,
      activeCategory: slug
    });
  }

  public static detail(req: Request, res: Response, next: NextFunction): void {
    const slug = String(req.params['slug'] || '').replace(/\.htm$/i, '');
    const product = productsService.getByKey(slug);
    if (!product) {
      next();
      return;
    }
    const titled = product.seo?.pageTitle || product.title;
    (res.locals as any).pageTitle = titled.includes('Solutec') ? titled : `${product.title} – Solutec`;
    (res.locals as any).pageDescription = product.seo?.pageDescription || '';
    (res.locals as any).pageImage = product.image || '';
    (res.locals as any).selected = 'products';
    (res.locals as any).bodyClass += ' woocommerce woocommerce-page';
    res.render('product', {
      product,
      categories: productsService.getCategories().map((item) => ({
        ...item,
        count: productsService.getByCategory(item.slug).length
      }))
    });
  }
}
