import { Menu } from '../../admin/services/menuService';
export declare class MenuService {
    private static instance;
    static getInstance(): MenuService;
    getAllMenus(): Promise<Menu[]>;
    getMenuById(id: string): Promise<Menu | null>;
    reloadMenus(): void;
}
export declare const menuService: MenuService;
//# sourceMappingURL=menuService.d.ts.map