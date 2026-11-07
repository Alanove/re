/** Shared RichTextEditor option and facade types. */

export interface FontOption {
  text: string;
  value: string;
  /** font-family stack written into content; derived from `value` when omitted. */
  css?: string;
}

export interface EditorColorDefaults {
  /** Initial Text Color button swatch. */
  text: string;
  /** Initial Highlight button swatch. */
  highlight: string;
  /** Default table header background (empty = stylesheet default). */
  headerBackground: string;
  /** Default table header text color (empty = inherit). */
  headerText: string;
}

export interface EditorColorConfig {
  /** Swatches shared by every color picker (text, highlight, table, cell, header). */
  palette: string[];
  defaults: EditorColorDefaults;
}

export interface BlockFormatOption {
  text: string;
  value: string;
}

export interface SymbolOption {
  /** Display name, used for the tooltip and accessible label. */
  text: string;
  /** HTML inserted into the editor (entity or literal character). */
  value: string;
  /** Glyph shown in the picker cell; defaults to the decoded `value`. */
  symbol?: string;
  /** Group header in the picker; defaults to 'Other'. */
  category?: string;
}

export interface RegisterSymbolsOptions {
  /** Replace the default list instead of appending to it. */
  replace?: boolean;
}

export interface FileListItem {
  id?: string | number;
  name: string;
  url: string;
  size?: number;
  isImage?: boolean;
}

export interface FileManagerConfig {
  /** Images that belong to the page being edited ("Page Images"). Receives pageKey / pageId query params. */
  pageListUrl: string;
  /** Shared image library ("Public Images"). */
  libraryListUrl: string;
  uploadUrl: string;
  /** Request header that carries the CSRF token (empty to skip the header). */
  csrfHeader: string;
  /** Multipart body field that also carries the CSRF token (empty to skip). */
  csrfField?: string;
  uploadFieldName?: string;
  /** Multipart body field that carries the page key on upload (empty to skip). */
  pageKeyField?: string;
  getCsrfToken: () => string;
  /** Current page key; uploads and Page Images are scoped to it. */
  getPageKey?: () => string | null | undefined;
  /** Current page id; sent alongside the key when known. */
  getPageId?: () => number | string | null | undefined;
  mapList: (response: unknown) => FileListItem[];
  mapUpload: (response: Record<string, unknown>) => { name?: string; url?: string };
  /** Upload target for files attached to links; a function receives the page key. */
  documentUploadUrl?: string | ((pageKey: string) => string);
  documentFieldName?: string;
  mapDocumentUpload?: (response: Record<string, unknown>) => { name?: string; url?: string };
}

export interface EditorOptions {
  height?: string;
  placeholder?: string;
  enableRichText?: boolean;
  enableSourceMode?: boolean;
  showImagePanel?: boolean;
  languageCode?: string;
  iconsBaseUrl?: string;
  templatesUrl?: string;
  fonts?: FontOption[];
  fontSizes?: FontOption[];
  blockFormats?: BlockFormatOption[];
  /** Palette for every color picker; defaults to RichTextEditor.COLORS.palette. */
  colors?: string[];
  /** Merged over RichTextEditor.COLORS.defaults. */
  colorDefaults?: Partial<EditorColorDefaults>;
  /** Replaces the default symbol set (RichTextEditor.DEFAULT_SYMBOLS). */
  symbols?: SymbolOption[];
  /** Appended to `symbols`; entries with an existing value replace the earlier one. */
  extraSymbols?: SymbolOption[];
  /** Number of columns in the symbol picker grid. */
  symbolColumns?: number;
  fileManager?: Partial<FileManagerConfig>;
  toolbar?: string[];
  toolbarPreset?: ToolbarPresetName | string;
  /** Buttons for the contextual toolbar shown above the table being edited. */
  tableToolbar?: string[];
  /** Entries of the Insert (+) menu; defaults to the preset's list. 'templates' also requires the templates button. */
  insertMenu?: string[];
  onChange?: ((html: string) => void) | null;
  maxLines?: number;
  initialContent?: string;
  [key: string]: unknown;
}

export interface EditorFacade {
  _core: import('./core').RichTextEditorCore;
  _el: HTMLElement;
  _textarea?: HTMLTextAreaElement;
  getHTML: () => string;
  setHTML: (html: string) => void;
  focus: () => void;
  destroy: () => void;
}

export type ToolbarPresetName = 'normal' | 'mini';

export interface ToolbarPresetDefinition {
  /** Parent preset whose groups and flags are inherited. */
  extends?: string;
  /** Group names from RichTextEditor.TOOLBAR_GROUPS; replaces the inherited list when set. */
  groups?: string[];
  /** Groups appended to the inherited list (or inserted before `before`). */
  add?: string[];
  before?: string;
  /** Groups dropped from the inherited list. */
  remove?: string[];
  /** Compact single-line editor behaviour (mini host classes, mini templates). */
  mini?: boolean;
  /** Toolbar floats above the editor while focused instead of being docked. */
  floating?: boolean;
  /** Default max lines for this preset (0 = unlimited). */
  maxLines?: number;
  /** Entries of the Insert (+) menu: 'html', 'templates', 'table', 'symbols'. */
  insertMenu?: string[];
}
