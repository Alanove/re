"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsController = void 0;
const pagesService_1 = require("../../admin/services/pagesService");
const database_1 = require("../config/database");
const adminPagesService = pagesService_1.PagesService.getInstance();
class NewsController {
    static async list(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'news'
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            res.locals.selected = 'novosti';
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news listing:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async article(req, res) {
        try {
            const slug = req.params.slug;
            const article = await adminPagesService.getPageBySlug(slug);
            if (!article || article.status !== 'published') {
                return res.status(404).render('404');
            }
            const hasNewsTag = article.tags && article.tags.some((tag) => tag.slug === 'news');
            if (!hasNewsTag) {
                return res.status(404).render('404');
            }
            const relatedResult = await adminPagesService.getPagesWithPagination({
                page: 1,
                itemsPerPage: 4,
                status: 'published',
                tag: 'news'
            });
            const relatedArticles = relatedResult.pages.filter((a) => a.id !== article.id).slice(0, 3);
            const pagePhotos = await adminPagesService.getPagePhotos(article.id);
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.locals.selected = `novosti-${article.slug}`;
            res.locals.pageTitle = article.title;
            res.locals.pageImage = article.pageImage || '';
            res.locals.pageDescription = article.metaDescription || article.description || '';
            res.render('news/article', {
                article: article,
                relatedArticles: relatedArticles,
                pagePhotos: pagePhotos || [],
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news article:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async listByYear(req, res) {
        try {
            const year = parseInt(req.params.year);
            if (isNaN(year)) {
                return res.status(404).render('404');
            }
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'news',
                year: year
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.locals.selected = 'novosti';
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                filterType: 'year',
                filterValue: year,
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news by year:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async listByMonth(req, res) {
        try {
            const dateParts = req.params.date.split('-');
            if (dateParts.length !== 2) {
                return res.status(404).render('404');
            }
            const month = parseInt(dateParts[0]);
            const year = parseInt(dateParts[1]);
            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                return res.status(404).render('404');
            }
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'news',
                year: year,
                month: month
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.locals.selected = 'novosti';
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                filterType: 'month',
                filterValue: { month, year },
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news by month:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async listByDay(req, res) {
        try {
            const dateParts = req.params.date.split('-');
            if (dateParts.length !== 3) {
                return res.status(404).render('404');
            }
            const day = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const year = parseInt(dateParts[2]);
            if (isNaN(day) || isNaN(month) || isNaN(year) ||
                day < 1 || day > 31 || month < 1 || month > 12) {
                return res.status(404).render('404');
            }
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: 'news',
                year: year,
                month: month,
                day: day
            });
            const totalPages = Math.ceil(result.total / itemsPerPage);
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.locals.selected = 'novosti';
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                filterType: 'day',
                filterValue: { day, month, year },
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news by day:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    static async listByTag(req, res) {
        try {
            const tagSlug = req.params.tagSlug;
            if (!tagSlug) {
                return res.status(404).render('404');
            }
            const [tagRows] = await database_1.db.query('SELECT name, slug FROM page_tags WHERE slug = ?', [tagSlug]);
            const tags = tagRows;
            if (!tags || tags.length === 0) {
                return res.status(404).render('404');
            }
            const tagName = tags[0].name;
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = 12;
            const result = await adminPagesService.getPagesWithPagination({
                page,
                itemsPerPage,
                status: 'published',
                tag: tagSlug
            });
            const newsDates = await adminPagesService.getNewsDates();
            const archiveDates = await adminPagesService.getNewsArchiveDates();
            res.locals.selected = 'novosti';
            const totalPages = Math.ceil(result.total / itemsPerPage);
            res.render('news/list', {
                articles: result.pages,
                currentPage: page,
                totalPages: totalPages,
                totalArticles: result.total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                filterType: 'tag',
                filterValue: tagSlug,
                tagName: tagName,
                newsDates: newsDates,
                archiveDates: archiveDates
            });
        }
        catch (error) {
            console.error('Error rendering news by tag:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
exports.NewsController = NewsController;
//# sourceMappingURL=newsController.js.map