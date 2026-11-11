import { db } from '../../src/config/database';

export interface Account {
    id: number;
    name: string;
    currency: string;
    createdAt: string;
    isActive: boolean;
    notes?: string;
}

export interface AccountWithBalance extends Account {
    balance: number;
}

export class AccountsService {
    private static instance: AccountsService;

    public static getInstance(): AccountsService {
        if (!AccountsService.instance) {
            AccountsService.instance = new AccountsService();
        }
        return AccountsService.instance;
    }

    async getAllAccounts(): Promise<Account[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, name, currency, 
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
                    is_active as isActive, description as notes
                FROM accounts
                ORDER BY id DESC
            `);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                isActive: Boolean(row.isActive)
            }));
        } catch (error) {
            console.error('Error fetching accounts:', error);
            return [];
        }
    }

    async getAllAccountsWithBalance(): Promise<AccountWithBalance[]> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    a.id, a.name, a.currency, 
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
                    a.is_active as isActive, a.description as notes,
                    IFNULL((
                        SELECT 
                            SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
                        FROM transactions t
                        WHERE t.account_id = a.id
                    ), 0) as balance
                FROM accounts a
                ORDER BY a.id DESC
            `);
            return (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                balance: parseFloat(row.balance),
                isActive: Boolean(row.isActive)
            }));
        } catch (error) {
            console.error('Error fetching accounts with balance:', error);
            return [];
        }
    }

    async getAccountById(id: number): Promise<Account | null> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    id, name, currency, 
                    DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt,
                    is_active as isActive, description as notes
                FROM accounts
                WHERE id = ?
            `, [id]);
            const accounts = (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                isActive: Boolean(row.isActive)
            }));
            return accounts[0] || null;
        } catch (error) {
            console.error('Error fetching account by ID:', error);
            return null;
        }
    }

    async getAccountByIdWithBalance(id: number): Promise<AccountWithBalance | null> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    a.id, a.name, a.currency, 
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%TZ') as createdAt,
                    a.is_active as isActive, a.description as notes,
                    IFNULL((
                        SELECT 
                            SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
                        FROM transactions t
                        WHERE t.account_id = a.id
                    ), 0) as balance
                FROM accounts a
                WHERE a.id = ?
            `, [id]);
            const accounts = (rows as any[]).map(row => ({
                ...row,
                id: parseInt(row.id),
                balance: parseFloat(row.balance),
                isActive: Boolean(row.isActive)
            }));
            return accounts[0] || null;
        } catch (error) {
            console.error('Error fetching account with balance:', error);
            return null;
        }
    }


    async createAccount(accountData: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
        try {
            const [result] = await db.query(`
                INSERT INTO accounts (name, balance, currency, description, is_active)
                VALUES (?, 0, ?, ?, ?)
            `, [
                accountData.name,
                accountData.currency || 'XAF',
                accountData.notes || '',
                accountData.isActive ? 1 : 0
            ]);
            
            const insertId = (result as any).insertId;
            const newAccount = await this.getAccountById(insertId);
            if (!newAccount) throw new Error('Failed to retrieve created account');
            return newAccount;
        } catch (error) {
            console.error('Error creating account:', error);
            throw new Error('Failed to create account');
        }
    }

    async updateAccount(id: number, updateData: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account | null> {
        try {
            const updateFields: string[] = [];
            const values: any[] = [];
            
            if (updateData.name !== undefined) {
                updateFields.push('name = ?');
                values.push(updateData.name);
            }
            if (updateData.currency !== undefined) {
                updateFields.push('currency = ?');
                values.push(updateData.currency);
            }
            if (updateData.isActive !== undefined) {
                updateFields.push('is_active = ?');
                values.push(updateData.isActive ? 1 : 0);
            }
            if (updateData.notes !== undefined) {
                updateFields.push('description = ?');
                values.push(updateData.notes);
            }

            if (updateFields.length === 0) {
                return await this.getAccountById(id);
            }

            values.push(id);
            await db.query(`
                UPDATE accounts
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, values);
            
            return await this.getAccountById(id);
        } catch (error) {
            console.error('Error updating account:', error);
            return null;
        }
    }

    async deleteAccount(id: number): Promise<boolean> {
        try {
            const [result] = await db.query(`
                DELETE FROM accounts WHERE id = ?
            `, [id]);
            
            return (result as any).affectedRows > 0;
        } catch (error) {
            console.error('Error deleting account:', error);
            return false;
        }
    }

    async getTotalAmount(): Promise<number> {
        try {
            const [rows] = await db.query(`
                SELECT 
                    IFNULL(SUM(
                        CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END
                    ), 0) as total
                FROM transactions t
            `);
            
            return parseFloat((rows as any)[0].total) || 0;
        } catch (error) {
            console.error('Error calculating total amount:', error);
            return 0;
        }
    }
}
