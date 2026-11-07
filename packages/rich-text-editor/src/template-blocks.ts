/**
 * Editor chrome for template roots and hidden separators.
 * Remove buttons are contenteditable=false and stripped on save (BUTTON is removed by sanitizer).
 */

export const RTE_TEMPLATE_ROOT_CLASSES = [
  'rte-two-images',
  'rte-three-images',
  'rte-text-block',
  'rte-split-line',
  'rte-title-with-line',
  'rte-stat-columns',
  'rte-two-column-list',
  'rte-image-cards',
  'rte-media-cards',
  'rte-quote',
] as const;

export const RTE_TEMPLATE_ROOT_SELECTOR = RTE_TEMPLATE_ROOT_CLASSES.map((c) => '.' + c).join(',');

export const RTE_HIDDEN_SEP_CLASS = 'rte-hidden-sep';

const RTE_MEDIA_CARD_CLASS = 'rte-media-card';
const RTE_TEMPLATE_ITEM_CLASS = 'rte-template-item';
const RTE_TEMPLATE_TEXT_ACTIVE_CLASS = 'rte-template-text-active';
const RTE_TEMPLATE_TEXT_EMPTY_CLASS = 'rte-template-text-empty';
const RTE_TEMPLATE_TEXT_FIELD_SELECTOR = ['.rte-media-card-title', '.rte-media-card-body'].join(',');

interface RepeatableTemplateConfig {
  rootClass: string;
  itemClass: string;
  addLabel: string;
  removeLabel: string;
  resetClone: (clone: HTMLElement) => void;
}

const REPEATABLE_TEMPLATE_CONFIGS: RepeatableTemplateConfig[] = [
  {
    rootClass: 'rte-stat-columns',
    itemClass: 'rte-stat',
    addLabel: 'Add statistic',
    removeLabel: 'Remove statistic',
    resetClone: (clone) => {
      const value = clone.querySelector<HTMLElement>('.rte-stat-value');
      const label = clone.querySelector<HTMLElement>('.rte-stat-label');
      if (value) value.textContent = '0';
      if (label) label.textContent = 'Describe this number';
    },
  },
  {
    rootClass: 'rte-image-cards',
    itemClass: 'rte-image-card',
    addLabel: 'Add card',
    removeLabel: 'Remove card',
    resetClone: (clone) => {
      const caption = clone.querySelector<HTMLElement>('.rte-image-card-caption');
      if (caption) caption.textContent = 'Caption';
    },
  },
  {
    rootClass: 'rte-media-cards',
    itemClass: RTE_MEDIA_CARD_CLASS,
    addLabel: 'Add card',
    removeLabel: 'Remove card',
    resetClone: (clone) => {
      const title = clone.querySelector<HTMLElement>('.rte-media-card-title');
      const body = clone.querySelector<HTMLElement>('.rte-media-card-body');
      if (title) title.textContent = '';
      if (body) body.textContent = '';
      const image = clone.querySelector<HTMLImageElement>('img');
      if (image) image.alt = 'Card image';
    },
  },
];

function createActionButton(className: string, ariaLabel: string, text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('contenteditable', 'false');
  btn.setAttribute('aria-label', ariaLabel);
  btn.title = ariaLabel;
  btn.textContent = text;
  return btn;
}

function decorateRemoveable(el: HTMLElement, ariaLabel: string): void {
  if (!el.querySelector(':scope > .rte-template-remove')) {
    el.insertBefore(createActionButton('rte-template-remove', ariaLabel, '\u00D7'), el.firstChild);
  }
  el.classList.add('rte-template-block');
}

function getRepeatableConfig(root: Element | null): RepeatableTemplateConfig | undefined {
  return REPEATABLE_TEMPLATE_CONFIGS.find(
    (config) => root instanceof HTMLElement && root.classList.contains(config.rootClass),
  );
}

function getRepeatableRoot(node: Element): HTMLElement | null {
  const selector = REPEATABLE_TEMPLATE_CONFIGS.map((config) => '.' + config.rootClass).join(',');
  return node.closest(selector) as HTMLElement | null;
}

function getRepeatableItems(root: HTMLElement, config: RepeatableTemplateConfig): HTMLElement[] {
  return Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(config.itemClass),
  );
}

function decorateRepeatableTemplate(root: HTMLElement, config: RepeatableTemplateConfig): void {
  if (!root.querySelector(':scope > .rte-template-add-item')) {
    root.insertBefore(
      createActionButton('rte-template-add-item', config.addLabel, '+ ' + config.addLabel),
      root.firstChild,
    );
  }

  const items = getRepeatableItems(root, config);
  items.forEach((item) => {
    item.classList.add(RTE_TEMPLATE_ITEM_CLASS);
    if (!item.querySelector(':scope > .rte-template-item-remove')) {
      item.insertBefore(createActionButton('rte-template-item-remove', config.removeLabel, '\u00D7'), item.firstChild);
    }
    const remove = item.querySelector<HTMLButtonElement>(':scope > .rte-template-item-remove');
    if (remove) {
      remove.disabled = items.length <= 1;
      remove.setAttribute('aria-disabled', String(remove.disabled));
    }
  });
}

function getTemplateTextPlaceholder(field: HTMLElement): string {
  return field.classList.contains('rte-media-card-title') ? 'Type card title' : 'Type card description';
}

function updateTemplateTextFieldState(field: HTMLElement): void {
  const isEmpty = !(field.textContent || '').replace(/\u00a0/g, ' ').trim();
  field.classList.toggle(RTE_TEMPLATE_TEXT_EMPTY_CLASS, isEmpty);
}

/** Card titles stay single-block text: nested blocks typed or pasted into them are flattened to lines. */
function normalizePlainTemplateTextField(field: HTMLElement, moveCaret = false): void {
  if (!field.classList.contains('rte-media-card-title') || !field.querySelector('div,p,ul,ol,li')) return;

  const text = (field.innerText || field.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  field.replaceChildren();
  text.split('\n').forEach((line, index) => {
    if (index > 0) field.appendChild(document.createElement('br'));
    if (line) field.appendChild(document.createTextNode(line));
  });

  if (moveCaret) {
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

/** Move stray text typed between the card fields back into the title / body. */
function normalizeMediaCard(card: HTMLElement): void {
  const content = card.querySelector<HTMLElement>('.rte-media-card-content');
  if (!content) return;
  const title = content.querySelector<HTMLElement>(':scope > .rte-media-card-title');
  const body = content.querySelector<HTMLElement>(':scope > .rte-media-card-body');
  Array.from(content.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== title && child !== body)
    .forEach((element) => {
      const target = /^H[1-6]$/.test(element.tagName) ? title : body;
      if (target) {
        if ((target.textContent || '').trim() && (element.textContent || '').trim()) {
          target.appendChild(document.createElement('br'));
        }
        target.append(...Array.from(element.childNodes));
      }
      element.remove();
    });
  Array.from(content.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE && !!(node.textContent || '').trim())
    .forEach((node) => {
      if (body) body.appendChild(node);
      else node.remove();
    });
}

function decorateTemplateTextFields(editor: HTMLElement): void {
  editor.querySelectorAll<HTMLElement>('.' + RTE_MEDIA_CARD_CLASS).forEach((card) => {
    normalizeMediaCard(card);
    card.setAttribute('contenteditable', 'false');
  });

  editor.querySelectorAll<HTMLElement>(RTE_TEMPLATE_TEXT_FIELD_SELECTOR).forEach((field) => {
    normalizePlainTemplateTextField(field);
    field.setAttribute('contenteditable', 'true');
    field.dataset.rtePlaceholder = getTemplateTextPlaceholder(field);
    field.title = 'Double-click to select all text';
    updateTemplateTextFieldState(field);
  });
}

/**
 * Add remove buttons / chrome to template roots and hidden separators inside the editor.
 */
export function decorateEditorBlocks(editor: HTMLElement | null | undefined): void {
  if (!editor || typeof document === 'undefined') {
    return;
  }

  editor.querySelectorAll(RTE_TEMPLATE_ROOT_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement) {
      decorateRemoveable(node, 'Remove template');
      const config = getRepeatableConfig(node);
      if (config) {
        decorateRepeatableTemplate(node, config);
      }
    }
  });
  decorateTemplateTextFields(editor);

  editor.querySelectorAll('hr.' + RTE_HIDDEN_SEP_CLASS).forEach((node) => {
    const hr = node as HTMLElement;
    let wrap = hr.parentElement;
    if (!wrap || !wrap.classList.contains('rte-hidden-sep-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'rte-hidden-sep-wrap rte-template-block';
      wrap.setAttribute('contenteditable', 'false');
      hr.parentNode?.insertBefore(wrap, hr);
      wrap.appendChild(hr);
    }
    decorateRemoveable(wrap, 'Remove separator');
    hr.classList.add(RTE_HIDDEN_SEP_CLASS);
  });
}

/**
 * Wire a single click handler on the editor for remove buttons.
 */
export function bindEditorBlockRemove(editor: HTMLElement, onChanged?: () => void): void {
  if ((editor as HTMLElement & { _rteBlockRemoveBound?: boolean })._rteBlockRemoveBound) {
    return;
  }
  (editor as HTMLElement & { _rteBlockRemoveBound?: boolean })._rteBlockRemoveBound = true;

  const textFieldObserver = new MutationObserver((mutations) => {
    const fields = new Set<HTMLElement>();
    const cards = new Set<HTMLElement>();
    mutations.forEach((mutation) => {
      const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
      const card = target?.closest('.' + RTE_MEDIA_CARD_CLASS) as HTMLElement | null;
      if (card && editor.contains(card)) cards.add(card);
      const field = target?.closest(RTE_TEMPLATE_TEXT_FIELD_SELECTOR) as HTMLElement | null;
      if (field && editor.contains(field)) fields.add(field);
    });
    cards.forEach((card) => {
      normalizeMediaCard(card);
      card.querySelectorAll<HTMLElement>(RTE_TEMPLATE_TEXT_FIELD_SELECTOR).forEach((field) => fields.add(field));
    });
    fields.forEach((field) => {
      normalizePlainTemplateTextField(field);
      updateTemplateTextFieldState(field);
    });
  });
  textFieldObserver.observe(editor, { childList: true, characterData: true, subtree: true });

  editor.addEventListener('input', (e) => {
    const target = e.target as Element | null;
    const field = target?.closest(RTE_TEMPLATE_TEXT_FIELD_SELECTOR) as HTMLElement | null;
    if (field && editor.contains(field)) {
      normalizePlainTemplateTextField(field, true);
      updateTemplateTextFieldState(field);
    }
  });

  editor.addEventListener('mousedown', (e) => {
    const target = e.target as Element | null;
    const field = target?.closest(RTE_TEMPLATE_TEXT_FIELD_SELECTOR) as HTMLElement | null;
    editor
      .querySelectorAll('.' + RTE_TEMPLATE_TEXT_ACTIVE_CLASS)
      .forEach((item) => item.classList.remove(RTE_TEMPLATE_TEXT_ACTIVE_CLASS));
    if (field && editor.contains(field)) {
      field.classList.add(RTE_TEMPLATE_TEXT_ACTIVE_CLASS);
    }
  });

  editor.addEventListener('dblclick', (e) => {
    const target = e.target as Element | null;
    const field = target?.closest(RTE_TEMPLATE_TEXT_FIELD_SELECTOR) as HTMLElement | null;
    if (!field || !editor.contains(field)) return;
    e.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(field);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

  editor.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target || typeof target.closest !== 'function') {
      return;
    }

    const addItem = target.closest('.rte-template-add-item');
    if (addItem && editor.contains(addItem)) {
      const root = getRepeatableRoot(addItem);
      const config = getRepeatableConfig(root);
      const items = root && config ? getRepeatableItems(root, config) : [];
      const source = items[items.length - 1];
      if (root && config && source) {
        e.preventDefault();
        e.stopPropagation();
        const clone = source.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.rte-template-item-remove').forEach((btn) => btn.remove());
        clone.classList.remove(RTE_TEMPLATE_ITEM_CLASS);
        config.resetClone(clone);
        root.appendChild(clone);
        decorateRepeatableTemplate(root, config);
        decorateTemplateTextFields(root);
        if (typeof onChanged === 'function') onChanged();
      }
      return;
    }

    const removeItem = target.closest('.rte-template-item-remove');
    if (removeItem && editor.contains(removeItem)) {
      const root = getRepeatableRoot(removeItem);
      const config = getRepeatableConfig(root);
      const item = config ? removeItem.closest('.' + config.itemClass) : null;
      if (root && config && item && getRepeatableItems(root, config).length > 1) {
        e.preventDefault();
        e.stopPropagation();
        item.remove();
        decorateRepeatableTemplate(root, config);
        if (typeof onChanged === 'function') onChanged();
      }
      return;
    }

    const btn = target.closest('.rte-template-remove');
    if (!btn || !editor.contains(btn)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const block = btn.closest('.rte-template-block');
    if (block && editor.contains(block)) {
      block.remove();
      if (typeof onChanged === 'function') onChanged();
    }
  });
}

/**
 * Strip editor-only chrome before persisting HTML.
 * - remove buttons
 * - unwrap .rte-hidden-sep-wrap back to bare hr.rte-hidden-sep
 * - drop rte-template-block class and contenteditable attrs used for chrome
 */
export function stripEditorChrome(root: HTMLElement): void {
  root
    .querySelectorAll('.rte-template-remove, .rte-template-add-item, .rte-template-item-remove, .rte-paste-upload')
    .forEach((btn) => btn.remove());

  root.querySelectorAll('.rte-hidden-sep-wrap').forEach((wrap) => {
    const hr = wrap.querySelector('hr.' + RTE_HIDDEN_SEP_CLASS);
    if (hr && wrap.parentNode) {
      wrap.parentNode.insertBefore(hr, wrap);
    }
    wrap.remove();
  });

  root.querySelectorAll('.rte-template-block').forEach((el) => {
    el.classList.remove('rte-template-block');
    if (el.getAttribute('contenteditable') === 'false') {
      el.removeAttribute('contenteditable');
    }
  });

  root.querySelectorAll('.' + RTE_TEMPLATE_ITEM_CLASS).forEach((el) => {
    el.classList.remove(RTE_TEMPLATE_ITEM_CLASS);
    el.removeAttribute('contenteditable');
  });

  root.querySelectorAll<HTMLElement>(RTE_TEMPLATE_TEXT_FIELD_SELECTOR).forEach((field) => {
    field.removeAttribute('contenteditable');
    field.classList.remove(RTE_TEMPLATE_TEXT_ACTIVE_CLASS, RTE_TEMPLATE_TEXT_EMPTY_CLASS);
    delete field.dataset.rtePlaceholder;
    if (field.title === 'Double-click to select all text') {
      field.removeAttribute('title');
    }
  });
}

/**
 * Drop trailing empty root nodes (br, empty p/div, nbsp-only).
 * Keeps middle empty blocks and meaningful content (images, tables, templates).
 */
export function stripTrailingEmptyBlocks(root: HTMLElement): void {
  const isEmptyish = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/\u00A0/g, ' ').trim() === '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') return true;
    if (tag === 'HR') return false;
    if (el.querySelector('img, table, iframe, video, svg, hr')) return false;
    if (RTE_TEMPLATE_ROOT_CLASSES.some((c) => el.classList.contains(c))) return false;
    if (el.classList.contains(RTE_HIDDEN_SEP_CLASS) || el.classList.contains('rte-hidden-sep-wrap')) return false;
    if ((el.textContent || '').replace(/\u00A0/g, ' ').trim() !== '') return false;
    return tag === 'P' || tag === 'DIV' || tag === 'SPAN';
  };

  while (root.lastChild && isEmptyish(root.lastChild)) {
    root.removeChild(root.lastChild);
  }
}
