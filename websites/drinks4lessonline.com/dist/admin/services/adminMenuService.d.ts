import { SupportedLanguage } from './i18nService';
export interface AdminMenuItem {
    id: number;
    title: string;
    url: string;
    parentId: number | null;
    order: number;
    icon: string;
    roles: string[];
    isVisible: boolean;
}
export declare class AdminMenuService {
    private static instance;
    private constructor();
    static getInstance(): AdminMenuService;
    private readMenuData;
    private writeMenuData;
    private processMenuItems;
    getAllMenuItems(language?: SupportedLanguage): Promise<AdminMenuItem[]>;
    getMenuItemById(id: number): Promise<AdminMenuItem | null>;
    createMenuItem(itemData: Omit<AdminMenuItem, 'id'>): Promise<AdminMenuItem>;
    updateMenuItem(id: number, updates: Partial<Omit<AdminMenuItem, 'id'>>): Promise<AdminMenuItem | null>;
    deleteMenuItem(id: number): Promise<boolean>;
    getMenuForUser(userRole: string, language?: SupportedLanguage): Promise<AdminMenuItem[]>;
    private urlMatches;
    private isCurrent;
    getMenuWithCurrent(currentUrl: string, language?: SupportedLanguage): Promise<any[]>;
    getMenu(language?: SupportedLanguage): Promise<AdminMenuItem[]>;
}
export declare const adminMenuService: AdminMenuService;
//# sourceMappingURL=adminMenuService.d.ts.map