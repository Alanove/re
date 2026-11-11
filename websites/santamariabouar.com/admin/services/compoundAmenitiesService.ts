import { db } from '../../src/config/database';

export interface CompoundAmenity {
  id: number;
  name: string;
  icon: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}

function mapRow(row: Record<string, unknown>): CompoundAmenity {
  return {
    id: parseInt(String(row.id), 10),
    name: String(row.name),
    icon: String(row.icon || 'bi-star'),
    description: (row.description as string) || null,
    sortOrder: parseInt(String(row.sortOrder), 10) || 0,
    isActive: Boolean(row.isActive)
  };
}

export class CompoundAmenitiesService {
  private static instance: CompoundAmenitiesService;

  public static getInstance(): CompoundAmenitiesService {
    if (!CompoundAmenitiesService.instance) {
      CompoundAmenitiesService.instance = new CompoundAmenitiesService();
    }
    return CompoundAmenitiesService.instance;
  }

  public async getActiveAmenities(): Promise<CompoundAmenity[]> {
    const [rows] = await db.query(`
      SELECT id, name, icon, description, sort_order as sortOrder, is_active as isActive
      FROM compound_amenities
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `);
    return (rows as Record<string, unknown>[]).map(mapRow);
  }

  public async getAllAmenities(): Promise<CompoundAmenity[]> {
    const [rows] = await db.query(`
      SELECT id, name, icon, description, sort_order as sortOrder, is_active as isActive
      FROM compound_amenities
      ORDER BY sort_order ASC, name ASC
    `);
    return (rows as Record<string, unknown>[]).map(mapRow);
  }

  public async getById(id: number): Promise<CompoundAmenity | null> {
    const [rows] = await db.query(`
      SELECT id, name, icon, description, sort_order as sortOrder, is_active as isActive
      FROM compound_amenities WHERE id = ?
    `, [id]);
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapRow(row) : null;
  }

  public async create(data: {
    name: string;
    icon: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }): Promise<number> {
    const [result] = await db.query(`
      INSERT INTO compound_amenities (name, icon, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      data.name.trim(),
      data.icon.trim() || 'bi-star',
      data.description?.trim() || null,
      data.sortOrder ?? 0,
      data.isActive !== false ? 1 : 0
    ]);
    return (result as any).insertId;
  }

  public async update(
    id: number,
    data: {
      name: string;
      icon: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ): Promise<boolean> {
    const [result] = await db.query(`
      UPDATE compound_amenities
      SET name = ?, icon = ?, description = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `, [
      data.name.trim(),
      data.icon.trim() || 'bi-star',
      data.description?.trim() || null,
      data.sortOrder ?? 0,
      data.isActive !== false ? 1 : 0,
      id
    ]);
    return (result as any).affectedRows > 0;
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await db.query(`DELETE FROM compound_amenities WHERE id = ?`, [id]);
    return (result as any).affectedRows > 0;
  }
}
