export interface User {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    password?: string;
    salt?: string;
    status: 'Active' | 'Inactive';
    role: 'Super Admin' | 'Admin' | 'Content Manager' | 'Accounting' | 'Member';
    createdAt: string;
    notes?: string;
    language?: string;
}
export declare class UsersService {
    private generateSalt;
    private hashPassword;
    private verifyPassword;
    authenticateUser(email: string, password: string): Promise<User | null>;
    getAllUsers(): Promise<User[]>;
    getActiveUsers(): Promise<User[]>;
    getUserById(id: number): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    createUser(userData: Omit<User, 'id' | 'password' | 'salt' | 'createdAt'> & {
        password?: string;
    }): Promise<User>;
    updateUser(id: number, updates: Partial<Omit<User, 'id' | 'password' | 'salt' | 'createdAt'>>): Promise<User | null>;
    updateUserPassword(id: number, newPassword: string): Promise<boolean>;
    updateUserStatus(id: number, status: 'Active' | 'Inactive'): Promise<boolean>;
    deleteUser(id: number): Promise<boolean>;
    getUsersCount(): Promise<number>;
    getActiveUsersCount(): Promise<number>;
    userExists(id: number): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
    validateUserData(userData: any, requireEmailPassword?: boolean): {
        isValid: boolean;
        errors: string[];
    };
    private isValidEmail;
    getUserStatistics(): Promise<{
        total: number;
        active: number;
        inactive: number;
    }>;
    getUsersWithApartmentCount(): Promise<(User & {
        apartmentCount: number;
    })[]>;
    getUserLanguage(userId: number): Promise<string>;
    updateUserLanguage(userId: number, language: string): Promise<boolean>;
    getUserWithApartments(userId: number): Promise<(User & {
        apartments: any[];
    }) | null>;
}
export declare const usersService: UsersService;
//# sourceMappingURL=usersService.d.ts.map