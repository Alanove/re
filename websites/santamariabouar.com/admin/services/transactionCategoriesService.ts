import { db } from '../../src/config/database';

export interface TransactionCategory {
    id: number;
    name: string;
    type: 'income' | 'expense' | 'both';
    color: string;
    isActive: boolean;
    createdAt: string;
}

export class TransactionCategoriesService {
    private static instance: TransactionCategoriesService;

    public static getInstance(): TransactionCategoriesService {
        if (!TransactionCategoriesService.instance) {
            TransactionCategoriesService.instance = new TransactionCategoriesService();
        }
        return TransactionCategoriesService.instance;
    }

    async getAllCategories(): Promise<TransactionCategory[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, name, type, color, 
                    1 as isActive,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transaction_categories
                ORDER BY name
            `);
            return rows as TransactionCategory[];
        } catch (error) {
            console.error('Error fetching transaction categories:', error);
            return [];
        }
    }

    async getActiveCategories(): Promise<TransactionCategory[]> {
        return await this.getAllCategories();
    }

    async getCategoryById(id: number): Promise<TransactionCategory | null> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, name, type, color,
                    1 as isActive,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transaction_categories
                WHERE id = ?
            `, [id]);
            const categories = rows as TransactionCategory[];
            return categories[0] || null;
        } catch (error) {
            console.error('Error fetching category by ID:', error);
            return null;
        }
    }

    async createCategory(categoryData: Omit<TransactionCategory, 'id' | 'createdAt'>): Promise<TransactionCategory> {
        try {
            const [result] = await db.query(`
                INSERT INTO transaction_categories (name, type, color)
                VALUES (?, ?, ?)
            `, [categoryData.name, categoryData.type, categoryData.color]);
            
            const insertId = (result as any).insertId;
            const newCategory = await this.getCategoryById(insertId);
            if (!newCategory) throw new Error('Failed to retrieve created category');
            
            console.log('TransactionCategoriesService: Category created successfully');
            return newCategory;
        } catch (error) {
            console.error('TransactionCategoriesService: Error creating category:', error);
            throw error;
        }
    }

    async updateCategory(id: number, updateData: Partial<Omit<TransactionCategory, 'id' | 'createdAt'>>): Promise<TransactionCategory | null> {
        try {
            const updateFields: string[] = [];
            const values: any[] = [];
            
            if (updateData.name !== undefined) {
                updateFields.push('name = ?');
                values.push(updateData.name);
            }
            if (updateData.type !== undefined) {
                updateFields.push('type = ?');
                values.push(updateData.type);
            }
            if (updateData.color !== undefined) {
                updateFields.push('color = ?');
                values.push(updateData.color);
            }

            if (updateFields.length === 0) {
                return await this.getCategoryById(id);
            }

            values.push(id);
            await db.query(`
                UPDATE transaction_categories
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, values);
            
            return await this.getCategoryById(id);
        } catch (error) {
            console.error('Error updating category:', error);
            return null;
        }
    }

    async deleteCategory(id: number): Promise<boolean> {
        try {
            const [result] = await db.query(`
                DELETE FROM transaction_categories WHERE id = ?
            `, [id]);
            
            return (result as any).affectedRows > 0;
        } catch (error) {
            console.error('Error deleting category:', error);
            return false;
        }
    }

    async getCategoriesByType(type: 'income' | 'expense'): Promise<TransactionCategory[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, name, type, color,
                    1 as isActive,
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
                FROM transaction_categories
                WHERE type = ? OR type = 'both'
                ORDER BY name
            `, [type]);
            return rows as TransactionCategory[];
        } catch (error) {
            console.error('Error fetching categories by type:', error);
            return [];
        }
    }
}
