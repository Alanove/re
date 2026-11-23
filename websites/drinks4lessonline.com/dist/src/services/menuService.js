"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuService = exports.MenuService = void 0;
const menuService_1 = require("../../admin/services/menuService");
const adminMenuService = menuService_1.MenuService.getInstance();
class MenuService {
    static getInstance() {
        if (!MenuService.instance) {
            MenuService.instance = new MenuService();
        }
        return MenuService.instance;
    }
    async getAllMenus() {
        return await adminMenuService.getAllMenus();
    }
    async getMenuById(id) {
        return await adminMenuService.getMenuById(id);
    }
    reloadMenus() {
        adminMenuService.reloadMenus();
    }
}
exports.MenuService = MenuService;
exports.menuService = MenuService.getInstance();
//# sourceMappingURL=menuService.js.map