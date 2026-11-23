"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsService = exports.ProjectsService = void 0;
const database_1 = require("../../src/config/database");
class ProjectsService {
    constructor() { }
    static getInstance() {
        if (!ProjectsService.instance) {
            ProjectsService.instance = new ProjectsService();
        }
        return ProjectsService.instance;
    }
    parseJsonField(value, defaultValue = []) {
        if (!value)
            return defaultValue;
        try {
            return JSON.parse(value);
        }
        catch {
            return defaultValue;
        }
    }
    async getAllProjects() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        ORDER BY order_index, year DESC
      `);
            return rows.map((row) => ({
                ...row,
                images: this.parseJsonField(row.images, []),
                tags: this.parseJsonField(row.tags, [])
            }));
        }
        catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    }
    async getProjectById(id) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE id = ?
      `, [id]);
            if (rows.length === 0)
                return null;
            const project = rows[0];
            return {
                ...project,
                images: this.parseJsonField(project.images, []),
                tags: this.parseJsonField(project.tags, [])
            };
        }
        catch (error) {
            console.error('Error fetching project by ID:', error);
            return null;
        }
    }
    async getProjectBySlug(slug) {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE slug = ?
      `, [slug]);
            if (rows.length === 0)
                return null;
            const project = rows[0];
            return {
                ...project,
                images: this.parseJsonField(project.images, []),
                tags: this.parseJsonField(project.tags, [])
            };
        }
        catch (error) {
            console.error('Error fetching project by slug:', error);
            return null;
        }
    }
    async createProject(projectData) {
        try {
            const [result] = await database_1.db.query(`
        INSERT INTO projects (title, slug, description, content, country, city, year, category, client, featured_image, images, tags, status, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                projectData.title,
                projectData.slug,
                projectData.description || '',
                projectData.content || '',
                projectData.country || '',
                projectData.city || '',
                projectData.year || null,
                projectData.category || '',
                projectData.client || '',
                projectData.featuredImage || '',
                JSON.stringify(projectData.images || []),
                JSON.stringify(projectData.tags || []),
                projectData.status || 'published',
                projectData.orderIndex || 0
            ]);
            const insertId = result.insertId;
            const newProject = await this.getProjectById(insertId);
            if (!newProject)
                throw new Error('Failed to retrieve created project');
            return newProject;
        }
        catch (error) {
            console.error('Error creating project:', error);
            throw new Error('Failed to create project');
        }
    }
    async updateProject(id, updates) {
        try {
            const updateFields = [];
            const values = [];
            if (updates.title !== undefined) {
                updateFields.push('title = ?');
                values.push(updates.title);
            }
            if (updates.slug !== undefined) {
                updateFields.push('slug = ?');
                values.push(updates.slug);
            }
            if (updates.description !== undefined) {
                updateFields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.content !== undefined) {
                updateFields.push('content = ?');
                values.push(updates.content);
            }
            if (updates.country !== undefined) {
                updateFields.push('country = ?');
                values.push(updates.country);
            }
            if (updates.city !== undefined) {
                updateFields.push('city = ?');
                values.push(updates.city);
            }
            if (updates.year !== undefined) {
                updateFields.push('year = ?');
                values.push(updates.year);
            }
            if (updates.category !== undefined) {
                updateFields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.client !== undefined) {
                updateFields.push('client = ?');
                values.push(updates.client);
            }
            if (updates.featuredImage !== undefined) {
                updateFields.push('featured_image = ?');
                values.push(updates.featuredImage);
            }
            if (updates.images !== undefined) {
                updateFields.push('images = ?');
                values.push(JSON.stringify(updates.images));
            }
            if (updates.tags !== undefined) {
                updateFields.push('tags = ?');
                values.push(JSON.stringify(updates.tags));
            }
            if (updates.status !== undefined) {
                updateFields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.orderIndex !== undefined) {
                updateFields.push('order_index = ?');
                values.push(updates.orderIndex);
            }
            if (updateFields.length === 0) {
                return await this.getProjectById(id);
            }
            values.push(id);
            await database_1.db.query(`
        UPDATE projects
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, values);
            return await this.getProjectById(id);
        }
        catch (error) {
            console.error('Error updating project:', error);
            return null;
        }
    }
    async deleteProject(id) {
        try {
            const [result] = await database_1.db.query(`
        DELETE FROM projects WHERE id = ?
      `, [id]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting project:', error);
            return false;
        }
    }
    async getPublishedProjects() {
        try {
            const [rows] = await database_1.db.query(`
        SELECT 
          id, title, slug, description, content,
          country, city, year, category, client,
          featured_image as featuredImage, images, tags,
          status, order_index as orderIndex,
          DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%dT%TZ') as updatedAt
        FROM projects
        WHERE status = 'published'
        ORDER BY order_index, year DESC
      `);
            return rows.map((row) => ({
                ...row,
                images: this.parseJsonField(row.images, []),
                tags: this.parseJsonField(row.tags, [])
            }));
        }
        catch (error) {
            console.error('Error fetching published projects:', error);
            return [];
        }
    }
    async getAllCategories() {
        try {
            const projects = await this.getAllProjects();
            const allCategories = new Set();
            projects.forEach(project => {
                if (project.tags && Array.isArray(project.tags)) {
                    project.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            allCategories.add(tag.trim());
                        }
                    });
                }
                if (project.category && project.category.trim()) {
                    allCategories.add(project.category.trim());
                }
            });
            return Array.from(allCategories).sort();
        }
        catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }
    getProjectImagePath(project) {
        if (project.featuredImage) {
            return `/uploads/projects/${project.slug}/${project.featuredImage}`;
        }
        if (project.project_image && project.folder_name) {
            return `/uploads/projects/${project.folder_name}/${project.project_image}`;
        }
        return '';
    }
    isWorkNewStructure(project, work) {
        return true;
    }
    async addWorkToProject(projectId, workData) {
        console.log('addWorkToProject called but not implemented yet. Project ID:', projectId);
        return null;
    }
    async updateWorkInProject(projectId, workId, workData) {
        console.log('updateWorkInProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
        return null;
    }
    async deleteWorkFromProject(projectId, workId) {
        console.log('deleteWorkFromProject called but not implemented yet. Project ID:', projectId, 'Work ID:', workId);
        return false;
    }
}
exports.ProjectsService = ProjectsService;
exports.projectsService = ProjectsService.getInstance();
//# sourceMappingURL=projectsService.js.map