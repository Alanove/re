# @local/table-sort

Click-to-sort columns for the CMS admin tables. Plain browser script, no dependencies.

## Use in a site

Each site builds the bundle into `admin/public/table-sort/` and commits the output:

```
npm run table-sort:build
```

The admin layout loads `/admin/table-sort/table-sort.css` and `/admin/table-sort/table-sort.js`. On page load every
`#content table` with a `thead` and `tbody` gets sortable headers.

## Markup

- `table[data-sort="off"]`: no sorting for this table.
- `th[data-sort="off"]`: this column is not sortable (use on Image, Actions and drag-handle columns). Headers with no text are skipped automatically.
- `td[data-sort-value="..."]`: value to sort by instead of the cell text (use ISO timestamps for dates).
- `tr[data-sort-pinned]`: row stays below the sorted rows. Rows with a single cell spanning the whole table (empty states) are pinned automatically.

Column types are detected from the values: numbers (`1,234`, `$12`, `75%`, `95,000 LBP`), dates (ISO, `dd/mm/yyyy[, hh:mm[:ss]]`, `5 Mar 2026`) and otherwise text (case-insensitive, natural number order). Empty placeholders (`—`, `-`, `Never`, `n/a`) always sort last.

Clicking a header cycles ascending, descending, original order. The last sort of each table is kept in `sessionStorage` for the browser tab.

## Commands

```
npm run build   # dist/table-sort.js, dist/table-sort.css
npm run check   # tsc --noEmit
npm test        # comparison logic
```

After changing this package, rebuild it into every site (`npm run table-sort:build` in each `websites/<domain>/`) and run the site build gates.
