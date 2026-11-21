import { DATA_FILES } from '../config/paths.js';
import { menusFileSchema, type Menu } from '../domain/models.js';
import { JsonFileStore } from './jsonFileStore.js';

export class MenusRepository {
  private readonly store = new JsonFileStore<Menu[]>(DATA_FILES.menus, menusFileSchema, () => []);

  public async findAll(): Promise<Menu[]> {
    return this.store.read();
  }

  public async findById(id: string): Promise<Menu | null> {
    const menus = await this.store.read();
    return menus.find((menu) => menu.id === id) ?? null;
  }

  public async save(menu: Menu): Promise<Menu> {
    return this.store.update((menus) => {
      const index = menus.findIndex((item) => item.id === menu.id);
      const next = [...menus];
      if (index === -1) {
        next.push(menu);
      } else {
        next[index] = menu;
      }
      return { next, result: menu };
    });
  }

  public async remove(id: string): Promise<boolean> {
    return this.store.update((menus) => {
      const next = menus.filter((menu) => menu.id !== id);
      return { next, result: next.length !== menus.length };
    });
  }
}

export const menusRepository = new MenusRepository();
