import { ensureNamespace } from './namespace';
import type { RegisterSymbolsOptions, SymbolOption, ToolbarPresetDefinition } from './types';

const RTE = ensureNamespace();

export const DEFAULT_TOOLBAR_PRESET = 'normal';

/** Reusable button groups; presets are composed from these and separated by '|'. */
RTE.TOOLBAR_GROUPS = {
  history: ['undo', 'redo'],
  search: ['find', 'findReplace'],
  clear: ['clearFormatting'],
  font: ['fontName', 'fontSize'],
  inline: ['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'uppercase'],
  color: ['foreColor', 'backColor'],
  block: ['formatBlock'],
  insertMenu: ['insertMenu'],
  templates: ['templates'],
  align: ['left', 'center', 'right', 'justify'],
  lists: ['bullet', 'number'],
  insert: ['symbols', 'hr', 'hiddenSep'],
  media: ['link', 'image', 'video'],
  table: ['table'],
  view: ['source', 'preview', 'expand'],

  miniInline: ['bold', 'italic', 'underline', 'uppercase'],
  miniAlign: ['left', 'center', 'right'],
  miniInsert: ['symbols'],
  miniMedia: ['link'],
};

/** Contextual table tools shown above the table being edited. */
RTE.TABLE_TOOLBAR = [
  'tableRowAbove', 'tableRowBelow', 'tableColLeft', 'tableColRight', '|',
  'tableDeleteRow', 'tableDeleteCol', '|',
  'tableMergeRight', 'tableMergeDown', 'tableSplitCell', '|',
  'tableCellProperties',
];

/**
 * Site CSS custom properties offered as swatches, in order. Missing or empty variables are skipped,
 * so each site gets only its own colors; the hex field and native picker still allow any color.
 */
RTE.SITE_COLOR_VARS = [
  '--color-primary',
  '--color-primary-dark',
  '--color-secondary',
  '--color-secondary-fixed',
  '--color-on-surface',
  '--color-surface',
  '--color-surface-low',
  '--color-surface-high',
  '--color-white',
];

/** Variables used for the initial Text Color / Highlight / table header swatches. */
const SITE_COLOR_DEFAULT_VARS = {
  text: '--color-primary',
  highlight: '--color-secondary-fixed',
  headerBackground: '--color-primary',
  headerText: '--color-white',
};

const COLOR_PROBE_ID = 'rte-color-probe';

/** Resolve any CSS color (named, rgb(), var-resolved) to #RRGGBB through the browser. */
function cssColorToHex(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  let probe = document.getElementById(COLOR_PROBE_ID);
  if (!probe) {
    probe = document.createElement('span');
    probe.id = COLOR_PROBE_ID;
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = raw;
  if (!probe.style.color) return '';
  const rgb = getComputedStyle(probe).color.match(/\d+/g);
  if (!rgb || rgb.length < 3) return '';
  return '#' + rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function readRootVar(name: string): string {
  return cssColorToHex(getComputedStyle(document.documentElement).getPropertyValue(name));
}

/** Current site colors from :root, de-duplicated, in SITE_COLOR_VARS order. */
RTE.readSiteColors = function (): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (RTE.SITE_COLOR_VARS || []).forEach((name) => {
    const hex = readRootVar(name);
    if (hex && !seen.has(hex)) {
      seen.add(hex);
      out.push(hex);
    }
  });
  return out;
};

/** Default swatches read from the site variables at editor creation (empty when the site does not define them). */
export function readSiteColorDefaults(): { text: string; highlight: string; headerBackground: string; headerText: string } {
  return {
    text: readRootVar(SITE_COLOR_DEFAULT_VARS.text),
    highlight: readRootVar(SITE_COLOR_DEFAULT_VARS.highlight),
    headerBackground: readRootVar(SITE_COLOR_DEFAULT_VARS.headerBackground),
    headerText: readRootVar(SITE_COLOR_DEFAULT_VARS.headerText),
  };
}

/**
 * Optional fixed palette. Empty by default: editors use RTE.readSiteColors() instead.
 * Set `palette` (or pass `colors` per editor) to override.
 */
RTE.COLORS = {
  palette: [],
  defaults: {
    text: '',
    highlight: '',
    headerBackground: '',
    headerText: '',
  },
};

/** Fonts offered in the Font dropdown; `css` is the font-family stack written into content. */
RTE.FONTS = [
  { text: 'Site font', value: 'inherit', css: 'inherit' },
  { text: 'Arial', value: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { text: 'Georgia', value: 'Georgia', css: 'Georgia, serif' },
  { text: 'Times New Roman', value: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { text: 'Courier New', value: 'Courier New', css: "'Courier New', Courier, monospace" },
];

function symbolSet(category: string, items: Array<[string, string, string?]>): SymbolOption[] {
  return items.map(([value, text, symbol]) => (symbol ? { value, text, symbol, category } : { value, text, category }));
}

/** Default symbol picker contents; editors copy this list unless `symbols` is passed at init. */
RTE.DEFAULT_SYMBOLS = [
  ...symbolSet('Common', [
    ['&copy;', 'Copyright'],
    ['&reg;', 'Registered Mark'],
    ['&trade;', 'Trademark'],
    ['&sect;', 'Section'],
    ['&para;', 'Pilcrow'],
    ['&deg;', 'Degree'],
    ['&bull;', 'Bullet'],
    ['&middot;', 'Middle Dot'],
    ['&hellip;', 'Ellipsis'],
    ['&mdash;', 'Em Dash'],
    ['&ndash;', 'En Dash'],
    ['&laquo;', 'Left Double Angle Quote'],
    ['&raquo;', 'Right Double Angle Quote'],
    ['&lsaquo;', 'Left Single Angle Quote'],
    ['&rsaquo;', 'Right Single Angle Quote'],
    ['&ldquo;', 'Left Double Quote'],
    ['&rdquo;', 'Right Double Quote'],
    ['&lsquo;', 'Left Single Quote'],
    ['&rsquo;', 'Right Single Quote'],
    ['&dagger;', 'Dagger'],
    ['&Dagger;', 'Double Dagger'],
    ['&nbsp;', 'Non-breaking Space', '\u2423'],
  ]),
  ...symbolSet('Currency', [
    ['&euro;', 'Euro'],
    ['&pound;', 'Pound'],
    ['&yen;', 'Yen'],
    ['&cent;', 'Cent'],
    ['&#8377;', 'Indian Rupee'],
    ['&curren;', 'Currency'],
  ]),
  ...symbolSet('Math', [
    ['&plusmn;', 'Plus-minus'],
    ['&times;', 'Multiplication'],
    ['&divide;', 'Division'],
    ['&ne;', 'Not Equal'],
    ['&asymp;', 'Almost Equal'],
    ['&le;', 'Less or Equal'],
    ['&ge;', 'Greater or Equal'],
    ['&infin;', 'Infinity'],
    ['&radic;', 'Square Root'],
    ['&sum;', 'Summation'],
    ['&prod;', 'Product'],
    ['&int;', 'Integral'],
    ['&part;', 'Partial Differential'],
    ['&#8710;', 'Increment'],
    ['&nabla;', 'Nabla'],
    ['&micro;', 'Micro'],
    ['&permil;', 'Per Mille'],
    ['&frac12;', 'One Half'],
    ['&frac14;', 'One Quarter'],
    ['&frac34;', 'Three Quarters'],
    ['&sup1;', 'Superscript One'],
    ['&sup2;', 'Superscript Two'],
    ['&sup3;', 'Superscript Three'],
    ['&isin;', 'Element Of'],
    ['&notin;', 'Not Element Of'],
    ['&cap;', 'Intersection'],
    ['&cup;', 'Union'],
    ['&sub;', 'Subset Of'],
    ['&sup;', 'Superset Of'],
    ['&forall;', 'For All'],
    ['&exist;', 'There Exists'],
    ['&not;', 'Not'],
    ['&and;', 'Logical And'],
    ['&or;', 'Logical Or'],
    ['&there4;', 'Therefore'],
  ]),
  ...symbolSet('Arrows', [
    ['&larr;', 'Left Arrow'],
    ['&rarr;', 'Right Arrow'],
    ['&uarr;', 'Up Arrow'],
    ['&darr;', 'Down Arrow'],
    ['&harr;', 'Left Right Arrow'],
    ['&#8597;', 'Up Down Arrow'],
    ['&lArr;', 'Left Double Arrow'],
    ['&rArr;', 'Right Double Arrow'],
    ['&hArr;', 'Left Right Double Arrow'],
  ]),
  ...symbolSet('Greek', [
    ['&alpha;', 'Alpha'],
    ['&beta;', 'Beta'],
    ['&gamma;', 'Gamma'],
    ['&delta;', 'Delta'],
    ['&epsilon;', 'Epsilon'],
    ['&theta;', 'Theta'],
    ['&lambda;', 'Lambda'],
    ['&mu;', 'Mu'],
    ['&pi;', 'Pi'],
    ['&rho;', 'Rho'],
    ['&sigma;', 'Sigma'],
    ['&tau;', 'Tau'],
    ['&phi;', 'Phi'],
    ['&omega;', 'Omega'],
    ['&Delta;', 'Capital Delta'],
    ['&Sigma;', 'Capital Sigma'],
    ['&Omega;', 'Capital Omega'],
  ]),
];

/** Merge symbols into `base`; an entry whose value already exists replaces the earlier one. */
export function mergeSymbols(base: SymbolOption[], extra: SymbolOption[]): SymbolOption[] {
  const incoming = extra.filter((s) => s && s.value);
  const values = new Set(incoming.map((s) => s.value));
  return base.filter((s) => !values.has(s.value)).concat(incoming);
}

/** Add symbols to (or replace) the defaults used by editors created afterwards. */
RTE.registerSymbols = function (items: SymbolOption[], options: RegisterSymbolsOptions = {}): void {
  if (!Array.isArray(items)) return;
  RTE.DEFAULT_SYMBOLS = options.replace
    ? items.slice()
    : mergeSymbols(RTE.DEFAULT_SYMBOLS || [], items);
};

RTE.TOOLBAR_PRESET_DEFS = {
  normal: {
    groups: [
      'insertMenu', 'history', 'search', 'clear', 'font', 'inline', 'color', 'block', 'templates',
      'align', 'lists', 'insert', 'media', 'table', 'view',
    ],
    insertMenu: ['html', 'templates', 'table', 'symbols'],
  },
  mini: {
    groups: ['history', 'clear', 'font', 'miniInline', 'color', 'templates', 'miniAlign', 'miniInsert', 'miniMedia'],
    mini: true,
    floating: true,
    maxLines: 1,
  },
};

/** Flat button lists per preset (kept for code that reads RTE.TOOLBAR_PRESETS directly). */
RTE.TOOLBAR_PRESETS = {};

function resolveGroupNames(name: string, seen: string[] = []): string[] {
  const defs = RTE.TOOLBAR_PRESET_DEFS || {};
  const def = defs[name];
  if (!def || seen.indexOf(name) >= 0) return [];
  let groups = def.extends ? resolveGroupNames(def.extends, seen.concat(name)) : [];
  if (def.groups) groups = def.groups.slice();
  if (def.remove) groups = groups.filter((g) => def.remove!.indexOf(g) < 0);
  if (def.add && def.add.length) {
    const at = def.before ? groups.indexOf(def.before) : -1;
    if (at >= 0) {
      groups.splice(at, 0, ...def.add);
    } else {
      groups = groups.concat(def.add);
    }
  }
  return groups;
}

/** Merged preset definition (flags inherited through `extends`). */
RTE.getToolbarPresetDef = function (name?: string | null): ToolbarPresetDefinition | null {
  const defs = RTE.TOOLBAR_PRESET_DEFS || {};
  if (!name || !defs[name]) return null;
  const chain: ToolbarPresetDefinition[] = [];
  let current: string | undefined = name;
  while (current && defs[current] && chain.indexOf(defs[current]) < 0) {
    chain.unshift(defs[current]);
    current = defs[current].extends;
  }
  return Object.assign({}, ...chain);
};

function hasToolbarPreset(name?: string | null): boolean {
  return !!(name && RTE.TOOLBAR_PRESET_DEFS && RTE.TOOLBAR_PRESET_DEFS[name]);
}
RTE.hasToolbarPreset = hasToolbarPreset;

/** Expand a preset into a flat toolbar array ('|' between non-empty groups). */
RTE.resolveToolbar = function (name?: string | null): string[] {
  const presetName = hasToolbarPreset(name) ? name! : DEFAULT_TOOLBAR_PRESET;
  const groups = RTE.TOOLBAR_GROUPS || {};
  const out: string[] = [];
  resolveGroupNames(presetName).forEach((groupName) => {
    const items = groups[groupName] || [];
    if (!items.length) return;
    if (out.length) out.push('|');
    out.push(...items);
  });
  return out;
};

/** Add or override a preset at runtime, e.g. RTE.registerToolbarPreset('news', { extends: 'normal', remove: ['media'] }). */
RTE.registerToolbarPreset = function (name: string, def: ToolbarPresetDefinition): void {
  if (!name || !def) return;
  RTE.TOOLBAR_PRESET_DEFS![name] = def;
  refreshFlatPresets();
};

/** Add or override a button group, then refresh the flat preset lists. */
RTE.registerToolbarGroup = function (name: string, items: string[]): void {
  if (!name || !Array.isArray(items)) return;
  RTE.TOOLBAR_GROUPS![name] = items.slice();
  refreshFlatPresets();
};

function refreshFlatPresets(): void {
  Object.keys(RTE.TOOLBAR_PRESET_DEFS || {}).forEach((key) => {
    RTE.TOOLBAR_PRESETS![key] = RTE.resolveToolbar!(key);
  });
}

refreshFlatPresets();
