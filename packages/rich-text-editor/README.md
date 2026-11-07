# Rich Text Editor (light)

Reusable WYSIWYG editor for CMS page content. No site-specific styles or colours: swatches and template accents come from the host site's CSS custom properties.

## Features

- Rich text and HTML source modes (CodeMirror), undo/redo, find and replace (Ctrl+F / Ctrl+H)
- Headings, bold/italic/underline/strike, sub/superscript, lists, alignment, font family and size, uppercase, clear formatting
- Text colour and highlight: site colour swatches plus a free colour picker
- Links (URL, page anchor, uploaded document), images (URL, upload, page images, image library, paste from clipboard), YouTube / Vimeo embeds
- Tables with a floating table toolbar (rows, columns, merge, split, cell and table properties)
- Generic content templates, symbols, horizontal rule, hidden separator, preview, fullscreen
- Toolbar presets: `normal` (default) and `mini` (single line, floating toolbar)

## Build

```bash
npm install
npm run check   # tsc --noEmit
npm run test    # URL / video / clear-formatting / HTML formatting unit tests
npm run build   # dist/: editor.js, editor.css, rte-content.css, templates.json, placeholder.svg, icons/
node esbuild.config.mjs --out <host>/admin/public/editor   # build and copy into a host project
```

## Files a host loads

| File | Where |
|------|-------|
| `editor.js`, `editor.css` | Admin pages with an editor |
| `rte-content.css` | Admin and public pages (templates, image styles, tables, video embeds) |
| `templates.json`, `placeholder.svg`, `icons/` | Same folder as `editor.js` |

## Mounting

```js
RichTextEditor.mountTextarea(textarea, {
  templatesUrl: '/admin/editor/templates.json',
  iconsBaseUrl: '/admin/editor/icons/',
  fileManager: {
    pageListUrl: '/admin/api/page-images',     // GET, receives pageKey / pageId query params
    libraryListUrl: '/admin/api/public-images', // GET
    uploadUrl: '/admin/api/upload-image',       // POST multipart
    uploadFieldName: 'image',
    pageKeyField: 'pageKey',                    // sent with uploads ('generic' when the page is unsaved)
    csrfHeader: 'X-CSRF-Token',
    csrfField: '_csrf',
    getCsrfToken: () => document.querySelector('meta[name="csrf-token"]').content,
    getPageKey: () => 'about-us',
    getPageId: () => 12,
    mapList: (r) => r.images,                   // [{ url, name, size }]
    mapUpload: (r) => ({ url: r.url }),
    documentUploadUrl: (pageKey) => `/admin/pages/${pageKey}/upload-file`,
    documentFieldName: 'file',
    mapDocumentUpload: (r) => ({ url: r.filePath, name: r.originalName })
  }
});
```

The textarea stays the form field: it is kept in sync on input and on submit. `RichTextEditor.getFromTextarea(textarea)` and `setOnTextarea(textarea, html)` read and write it. Inserting a video dispatches a bubbling `rte:video-inserted` event (`detail: { title, thumbnail, description }`) on the editor container.

## Colours

`RichTextEditor.SITE_COLOR_VARS` lists the custom properties read from `:root` for the swatches (default `--color-primary`, `--color-primary-dark`, `--color-secondary`, `--color-secondary-fixed`, `--color-on-surface`, `--color-surface`, `--color-surface-low`, `--color-surface-high`, `--color-white`). Missing variables are skipped. Default text and highlight colours use `--color-primary` and `--color-secondary-fixed`. Editor chrome uses `--rte-accent`, which follows `--color-primary`.

Set `RichTextEditor.COLORS.palette` (or pass `colors` per editor) to use a fixed palette instead.

## Templates

`templates/templates.json` entries are `{ id, title, availableIn: ['full'|'mini'], content }`. `{{templatesBase}}` in `content` becomes the folder of `templates.json`. The picker shows a live preview of each template.

Template markup uses `rte-*` classes only and is styled by `rte-content.css` with the host's `--color-*` variables. Repeatable templates (key figures, image cards, image and text cards) get add / remove item buttons in the editor; this chrome is stripped from saved HTML. To add a template root class, list it in `RTE_TEMPLATE_ROOT_CLASSES` in `src/template-blocks.ts` and style it in `styles/rte-content.css`.

## Sanitizing

`getHTML()` and the switch from HTML mode back to the rich view keep author markup (any tag, attribute, class, inline style, empty elements) and remove only: `script`, `noscript`, `style`, `template`, `object`, `embed`, `svg`, `math`, form controls, event handler attributes, `javascript:` / `vbscript:` URLs, unsafe inline styles, and iframes other than YouTube / Vimeo players. Hosts must sanitize again on save with the same rules; client checks do not stop forged requests.

## Video providers

Add a matcher in `src/video-providers.ts` that emits a fixed https embed URL, then allow the host in the server sanitizer's iframe hostnames and the CSP `frame-src`.
