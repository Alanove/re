import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { MenuItem } from '../../admin/services/menuService';

export const CUSTOMER_CARE_HEADER_TITLE = 'Customer Care';

/**
 * Top-level header mega entry (Customer Care links).
 */
export function customerCareHeaderMenuItem(): MenuItem {
  return {
    id: '0',
    title: CUSTOMER_CARE_HEADER_TITLE,
    type: 'external',
    link: 'contact-us',
    sort: 1,
    active: true,
    children: [
      {
        id: '0',
        title: 'Request Appointment',
        type: 'external',
        link: 'contact-us?subject=appointment',
        sort: 1,
        active: true,
        children: [],
      },
      {
        id: '0',
        title: 'Client Services',
        type: 'external',
        link: 'contact-us',
        sort: 2,
        active: true,
        children: [],
      },
      {
        id: '0',
        title: 'Wedding Dress Rental',
        type: 'external',
        link: 'shop/category/wedding-dress-rental',
        sort: 3,
        active: true,
        children: [],
      },
      {
        id: '0',
        title: 'Live Chat',
        type: 'external',
        link: 'contact-us?subject=Live%20Chat',
        sort: 4,
        active: true,
        children: [],
      },
    ],
  };
}

async function insertMenuSubtree(
  conn: PoolConnection,
  parentDbId: number,
  item: MenuItem,
  siblingIndex: number
): Promise<void> {
  const orderIdx = siblingIndex * 10;
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO menu (title, parent_id, order_index, url, is_visible, css_class) VALUES (?, ?, ?, ?, ?, ?)`,
    [item.title, parentDbId, orderIdx, (item.link || '').trim(), item.active !== false ? 1 : 0, item.type || '']
  );
  const newId = result.insertId;
  let c = 1;
  for (const child of item.children || []) {
    await insertMenuSubtree(conn, newId, child, c);
    c += 1;
  }
}

async function deleteSubtreeChildren(conn: PoolConnection, parentId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id FROM menu WHERE parent_id = ?', [parentId]);
  for (const row of rows) {
    const id = Number(row.id);
    await deleteSubtreeChildren(conn, id);
    await conn.query('DELETE FROM menu WHERE id = ?', [id]);
  }
}

/**
 * Removes the "Customer Care" top-level row (and descendants) under a header root, if present.
 */
export async function removeCustomerCareUnderHeaderRoot(conn: PoolConnection, headerRootId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM menu WHERE parent_id = ? AND title = ? LIMIT 1`,
    [headerRootId, CUSTOMER_CARE_HEADER_TITLE]
  );
  if (rows.length === 0) return;
  const nodeId = Number(rows[0].id);
  await deleteSubtreeChildren(conn, nodeId);
  await conn.query('DELETE FROM menu WHERE id = ?', [nodeId]);
}

/**
 * Appends the Customer Care tree under Header Right when no sibling with that title exists.
 * `siblingIndex` is 1-based among top-level right items (same convention as populate-header-nav cloneItemTree).
 */
export async function appendCustomerCareUnderHeaderRightIfMissing(
  conn: PoolConnection,
  rightRootId: number,
  siblingIndex: number
): Promise<void> {
  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM menu WHERE parent_id = ? AND title = ? LIMIT 1`,
    [rightRootId, CUSTOMER_CARE_HEADER_TITLE]
  );
  if (existing.length > 0) return;
  await insertMenuSubtree(conn, rightRootId, customerCareHeaderMenuItem(), siblingIndex);
}

/** Standalone / after existing right siblings: next slot at end of column. */
export async function appendCustomerCareUnderHeaderRightAfterExisting(
  conn: PoolConnection,
  rightRootId: number
): Promise<void> {
  const [countRows] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM menu WHERE parent_id = ?`,
    [rightRootId]
  );
  const nextIdx = Number(countRows[0]?.c || 0) + 1;
  await appendCustomerCareUnderHeaderRightIfMissing(conn, rightRootId, nextIdx);
}
