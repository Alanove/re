import type { Request, Response } from 'express';
import { BadRequestError } from '../../errors/httpError.js';
import { parseCsv, uncsvCell } from '../../lib/csv.js';
import { firstFile } from '../../middleware/upload.js';
import { BOOK_CSV_COLUMNS, bookCsvRowSchema, type BookCsvRow } from '../../schemas/adminSchemas.js';
import { libraryService } from '../../services/libraryService.js';
import { formErrorState, setFlash } from './helpers.js';

const MAX_ROWS = 20_000;
const MAX_REPORTED_ERRORS = 8;

function readRows(text: string): BookCsvRow[] {
  const [header, ...lines] = parseCsv(text);
  if (!header) {
    throw new BadRequestError('The file is empty.');
  }
  const columns = header.map((name) => name.trim());
  if (!columns.includes('title')) {
    throw new BadRequestError(`The first row must hold the column names (${BOOK_CSV_COLUMNS.join(', ')}). Export the books first and edit that file.`);
  }
  if (lines.length > MAX_ROWS) {
    throw new BadRequestError(`The file has ${lines.length} rows; the limit is ${MAX_ROWS}.`);
  }
  const known = new Set<string>(BOOK_CSV_COLUMNS);
  const rows: BookCsvRow[] = [];
  const problems: string[] = [];
  lines.forEach((cells, index) => {
    const record: Record<string, string> = {};
    columns.forEach((name, column) => {
      if (known.has(name)) {
        record[name] = uncsvCell(cells[column] ?? '');
      }
    });
    const parsed = bookCsvRowSchema.safeParse(record);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      const issue = parsed.error.issues[0];
      problems.push(`row ${index + 2}, ${String(issue?.path[0] ?? 'row')}: ${issue?.message ?? 'invalid value'}`);
    }
  });
  if (problems.length) {
    const more = problems.length > MAX_REPORTED_ERRORS ? ` and ${problems.length - MAX_REPORTED_ERRORS} more` : '';
    throw new BadRequestError(`Nothing was imported. Fix ${problems.slice(0, MAX_REPORTED_ERRORS).join('; ')}${more}.`);
  }
  return rows;
}

export class BooksBulkController {
  public static async exportCsv(_req: Request, res: Response): Promise<void> {
    const csv = await libraryService.exportCsv();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="books-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.set('Cache-Control', 'no-store');
    res.send(csv);
  }

  public static async importCsv(req: Request, res: Response): Promise<void> {
    const file = firstFile(req, 'csvFile');
    try {
      if (!file) {
        throw new BadRequestError('Choose a CSV file to import.');
      }
      const result = await libraryService.bulkUpsert(readRows(file.buffer.toString('utf8')));
      setFlash(req, 'success', `Import finished: ${result.created} added, ${result.updated} updated, ${result.unchanged} unchanged.`);
    } catch (error) {
      const state = formErrorState(error);
      if (!state) {
        throw error;
      }
      setFlash(req, 'danger', state.message);
    }
    res.redirect(303, '/admin/books');
  }
}
