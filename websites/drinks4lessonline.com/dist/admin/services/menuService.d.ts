export interface MenuItem {
    id: string;
    title: string;
    type: 'page' | 'file' | 'external' | '';
    link: string;
    sort: number;
    active: boolean;
    children: MenuItem[];
}
export interface Menu {
    id: string;
    name: string;
    description: string;
    items: MenuItem[];
}
export declare class MenuService {
    private static instance;
    private constructor();
    static getInstance(): MenuService;
    reloadMenus(): void;
    getAllMenus(): Promise<Menu[]>;
    getMenuById(id: string): Promise<Menu | null>;
    createMenu(menuData: Omit<Menu, 'id'>): Promise<Menu>;
    updateMenu(id: string, updates: Partial<Menu>): Promise<Menu | null>;
    deleteMenu(id: string): Promise<boolean>;
    private deleteMenuItemsRecursively;
    private getMenuItems;
    deleteMenuItem(menuId: string, itemId: string): Promise<boolean>;
    updateMenuItemsForPageKey(oldKey: string, newKey: string): Promise<number>;
    private deleteMenuItemFile;
    private generateId;
    validateMenuData(data: any): {
        isValid: boolean;
        errors: string[];
    };
    validateMenuItemData(data: any): {
        isValid: boolean;
        errors: string[];
    };
    addMenuItem(menuId: string, itemData: Omit<MenuItem, 'id' | 'children'>): Promise<MenuItem | null>;
    addChildMenuItem(menuId: string, parentId: string, itemData: Omit<MenuItem, 'id' | 'children'>): Promise<MenuItem | null>;
    updateMenuItem(menuId: string, itemId: string, updates: Partial<Omit<MenuItem, 'id' | 'children'>>): Promise<MenuItem | null>;
    moveMenuItem(menuId: string, itemId: string, newSort: number, newParentId: string | null): Promise<boolean>;
}
export declare const menuService: MenuService;
//# sourceMappingURL=menuService.d.ts.map