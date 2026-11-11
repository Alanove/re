import { detectType, nextDirection, normalize, sortIndexes, type SortDirection } from './compare';

export { detectType, parseDate, parseNumber, sortIndexes } from './compare';

const DEFAULT_SELECTOR = '#content table';
const STORAGE_PREFIX = 'table-sort:';
const ORIGINAL_INDEX = new WeakMap<HTMLTableRowElement, number>();

interface ColumnState {
  index: number;
  direction: SortDirection | null;
}

interface SavedSort {
  column: number;
  direction: SortDirection;
}

function headerRow(table: HTMLTableElement): HTMLTableRowElement | null {
  const head = table.tHead;
  if (!head || head.rows.length === 0) {
    return null;
  }
  return head.rows[head.rows.length - 1];
}

/** Maps a column number to the cell covering it, accounting for colspan. */
function cellAt(row: HTMLTableRowElement, column: number): HTMLTableCellElement | null {
  let position = 0;
  for (const cell of Array.from(row.cells)) {
    const span = Math.max(1, cell.colSpan);
    if (column < position + span) {
      return span === 1 ? cell : null;
    }
    position += span;
  }
  return null;
}

function columnCount(row: HTMLTableRowElement): number {
  return Array.from(row.cells).reduce((total, cell) => total + Math.max(1, cell.colSpan), 0);
}

/** Empty-state rows (one wide cell) and rows marked data-sort-pinned stay below the sorted rows. */
function isPinned(row: HTMLTableRowElement, columns: number): boolean {
  if (row.hasAttribute('data-sort-pinned')) {
    return true;
  }
  return columns > 1 && row.cells.length === 1 && row.cells[0].colSpan >= columns;
}

function cellValue(cell: HTMLTableCellElement | null): string {
  if (!cell) {
    return '';
  }
  const explicit = cell.getAttribute('data-sort-value');
  return explicit !== null ? explicit : normalize(cell.textContent || '');
}

function storageKey(table: HTMLTableElement, position: number): string {
  return `${STORAGE_PREFIX}${window.location.pathname}:${table.id || position}`;
}

function readSaved(key: string): SavedSort | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SavedSort>;
    if (typeof parsed.column === 'number' && (parsed.direction === 'ascending' || parsed.direction === 'descending')) {
      return { column: parsed.column, direction: parsed.direction };
    }
  } catch {
    return null;
  }
  return null;
}

function writeSaved(key: string, state: ColumnState | null): void {
  try {
    if (!state || state.direction === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify({ column: state.index, direction: state.direction }));
    }
  } catch {
    /* Storage can be unavailable (private mode, quota); sorting still works for this page view. */
  }
}

function sortBody(body: HTMLTableSectionElement, columns: number, state: ColumnState | null): void {
  const rows = Array.from(body.rows);
  const pinned = rows.filter((row) => isPinned(row, columns));
  const sortable = rows.filter((row) => !isPinned(row, columns));
  let ordered: HTMLTableRowElement[];
  if (!state || state.direction === null) {
    ordered = sortable.slice().sort((a, b) => (ORIGINAL_INDEX.get(a) ?? 0) - (ORIGINAL_INDEX.get(b) ?? 0));
  } else {
    const values = sortable.map((row) => cellValue(cellAt(row, state.index)));
    ordered = sortIndexes(values, state.direction, detectType(values)).map((index) => sortable[index]);
  }
  const fragment = document.createDocumentFragment();
  ordered.concat(pinned).forEach((row) => fragment.appendChild(row));
  body.appendChild(fragment);
}

function enhanceTable(table: HTMLTableElement, position: number): void {
  if (table.dataset.sort === 'off' || table.dataset.sortReady === '1') {
    return;
  }
  const header = headerRow(table);
  if (!header || table.tBodies.length === 0) {
    return;
  }
  const columns = columnCount(header);
  Array.from(table.tBodies).forEach((body) => {
    Array.from(body.rows).forEach((row, index) => ORIGINAL_INDEX.set(row, index));
  });

  const key = storageKey(table, position);
  const headings: { cell: HTMLTableCellElement; index: number; button: HTMLButtonElement }[] = [];
  let state: ColumnState | null = null;

  const render = (): void => {
    headings.forEach((heading) => {
      const direction = state && state.index === heading.index ? state.direction : null;
      if (direction) {
        heading.cell.setAttribute('aria-sort', direction);
      } else {
        heading.cell.removeAttribute('aria-sort');
      }
      heading.button.dataset.direction = direction || 'none';
      const label = normalize(heading.cell.textContent || '');
      heading.button.title =
        direction === 'ascending' ? `Sorted ${label} ascending. Click to sort descending.` : direction === 'descending' ? `Sorted ${label} descending. Click to restore the original order.` : `Sort by ${label}`;
    });
    Array.from(table.tBodies).forEach((body) => sortBody(body, columns, state));
  };

  let column = 0;
  Array.from(header.cells).forEach((cell) => {
    const span = Math.max(1, cell.colSpan);
    const index = column;
    column += span;
    const label = normalize(cell.textContent || '');
    if (span !== 1 || cell.dataset.sort === 'off' || label === '') {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-sort-button';
    while (cell.firstChild) {
      button.appendChild(cell.firstChild);
    }
    const icon = document.createElement('span');
    icon.className = 'table-sort-icon';
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    cell.appendChild(button);
    cell.classList.add('table-sort-header');
    button.addEventListener('click', () => {
      const current = state && state.index === index ? state.direction : null;
      const direction = nextDirection(current);
      state = direction ? { index, direction } : null;
      writeSaved(key, state);
      render();
    });
    headings.push({ cell, index, button });
  });

  if (headings.length === 0) {
    return;
  }
  table.dataset.sortReady = '1';
  table.classList.add('table-sortable');

  const saved = readSaved(key);
  if (saved && headings.some((heading) => heading.index === saved.column)) {
    state = { index: saved.column, direction: saved.direction };
  }
  render();
}

/** Adds sortable headers to every matching table that has a thead and tbody. */
export function initTableSort(root: ParentNode = document, selector: string = DEFAULT_SELECTOR): void {
  root.querySelectorAll<HTMLTableElement>(selector).forEach((table, position) => enhanceTable(table, position));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTableSort());
  } else {
    initTableSort();
  }
}
